import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  canPermanentDeleteAsset,
  canPermanentDeleteFolder,
  canAccessProject,
} from '@/lib/permissions';
import { hardDeleteAsset, hardDeleteFolder } from '@/lib/trash';
import type { Project } from '@/types';

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { projectId } = await request.json();
  if (!projectId || typeof projectId !== 'string') {
    return NextResponse.json({ error: 'projectId required' }, { status: 400 });
  }

  try {
    const db = getAdminDb();
    const projDoc = await db.collection('projects').doc(projectId).get();
    if (!projDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const project = { id: projDoc.id, ...projDoc.data() } as Project;
    if (!canAccessProject(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    if (!canPermanentDeleteAsset(user, project) || !canPermanentDeleteFolder(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const [assetsSnap, foldersSnap] = await Promise.all([
      db.collection('assets').where('projectId', '==', projectId).get(),
      db.collection('folders').where('projectId', '==', projectId).get(),
    ]);

    const trashedAssetIds = assetsSnap.docs
      .filter((d) => !!(d.data() as any).deletedAt)
      .map((d) => d.id);
    const trashedFolderIds = foldersSnap.docs
      .filter((d) => !!(d.data() as any).deletedAt)
      .map((d) => d.id);

    // Folders first — hardDeleteFolder cascades into any contained assets
    // (even ones not themselves soft-deleted). Then clean up lone trashed
    // assets. Sequential to keep GCS request rate sane.
    for (const fid of trashedFolderIds) {
      await hardDeleteFolder(db, fid);
    }
    for (const aid of trashedAssetIds) {
      // May already be gone if its parent folder's cascade removed it —
      // hardDeleteAsset no-ops on missing.
      await hardDeleteAsset(db, aid);
    }

    return NextResponse.json({
      success: true,
      foldersDeleted: trashedFolderIds.length,
      assetsDeleted: trashedAssetIds.length,
    });
  } catch (err) {
    console.error('Empty trash error:', err);
    return NextResponse.json({ error: 'Failed to empty trash' }, { status: 500 });
  }
}
