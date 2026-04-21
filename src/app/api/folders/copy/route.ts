import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { canCreateFolder } from '@/lib/permissions';
import { deepCopyFolder } from '@/lib/folders';
import type { Project } from '@/types';

/**
 * POST /api/folders/copy
 *
 * Deep-copies a folder + all subfolders + non-deleted assets inside them to the
 * destination. Returns { folder, counts: { folders, assets } }. The `counts` field
 * is additive — existing clients that only read `folder` keep working.
 */
export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { folderId, targetParentId, name } = await request.json();
    if (!folderId) return NextResponse.json({ error: 'folderId required' }, { status: 400 });

    const db = getAdminDb();
    const doc = await db.collection('folders').doc(folderId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const source = doc.data() as any;
    const projDoc = await db.collection('projects').doc(source.projectId).get();
    if (!projDoc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const project = { id: projDoc.id, ...projDoc.data() } as Project;
    // Duplicating a folder is a create-like write — use canCreateFolder.
    if (!canCreateFolder(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // targetParentId: if omitted default to same parent (Duplicate behaviour)
    const destinationParentId = targetParentId !== undefined ? targetParentId : source.parentId;

    const { newRootId, counts } = await deepCopyFolder(
      db,
      folderId,
      destinationParentId ?? null,
      source.projectId,
      user.id,
      name,
    );

    const newDoc = await db.collection('folders').doc(newRootId).get();
    return NextResponse.json(
      { folder: { id: newRootId, ...newDoc.data() }, counts },
      { status: 201 },
    );
  } catch (err) {
    console.error('POST folders/copy error:', err);
    return NextResponse.json({ error: 'Failed to copy folder' }, { status: 500 });
  }
}
