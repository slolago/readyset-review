import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import { Timestamp } from 'firebase-admin/firestore';
import { canAccessProject, canCreateFolder } from '@/lib/permissions';
import type { Project } from '@/types';

async function loadProject(projectId: string): Promise<Project | null> {
  const db = getAdminDb();
  const doc = await db.collection('projects').doc(projectId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Project;
}

export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('projectId');
  const parentId = searchParams.get('parentId') || null;
  const all = searchParams.get('all') === 'true';

  if (!projectId) return NextResponse.json({ error: 'projectId required' }, { status: 400 });

  const project = await loadProject(projectId);
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!canAccessProject(user, project)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const db = getAdminDb();

    // Phase 63 (IDX-03): composite index on folders(projectId, parentId, deletedAt)
    // lets us fetch only live folders at a given tree level without scanning the
    // full project collection. `?all=true` requests every live folder, which uses
    // the (projectId, deletedAt) index instead. Fall back to an in-memory filter
    // while the index is still provisioning.
    let liveFolders: any[];
    try {
      if (all) {
        const snap = await db
          .collection('folders')
          .where('projectId', '==', projectId)
          .where('deletedAt', '==', null)
          .get();
        liveFolders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      } else {
        const snap = await db
          .collection('folders')
          .where('projectId', '==', projectId)
          .where('parentId', '==', parentId)
          .where('deletedAt', '==', null)
          .get();
        liveFolders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/index/i.test(msg) || /FAILED_PRECONDITION/i.test(msg)) {
        console.warn(
          '[GET /api/folders] Composite index not deployed yet — falling back to in-memory filter. Deploy firestore.indexes.json.'
        );
        const snap = await db.collection('folders').where('projectId', '==', projectId).get();
        const allFolders = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
        liveFolders = allFolders.filter((f: any) => !f.deletedAt);
        if (!all) {
          liveFolders = liveFolders.filter((f: any) => (f.parentId ?? null) === parentId);
        }
      } else {
        throw err;
      }
    }

    const folders = liveFolders.sort(
      (a: any, b: any) => a.createdAt?.toMillis() - b.createdAt?.toMillis()
    );

    return NextResponse.json({ folders });
  } catch (err) {
    console.error('GET folders error:', err);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { name, projectId, parentId } = await request.json();
    if (!name || !projectId) return NextResponse.json({ error: 'name and projectId required' }, { status: 400 });

    const project = await loadProject(projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canCreateFolder(user, project)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const db = getAdminDb();
    let path: string[] = [];
    if (parentId) {
      const parentDoc = await db.collection('folders').doc(parentId).get();
      if (parentDoc.exists) {
        const parent = parentDoc.data() as any;
        path = [...(parent.path || []), parentId];
      }
    }

    const ref = await db.collection('folders').add({
      name,
      projectId,
      parentId: parentId || null,
      path,
      createdAt: Timestamp.now(),
      // Phase 63 (IDX-03): explicit null so composite-indexed queries filtering on
      // deletedAt surface this folder. Pre-Phase-63 folders may lack this field.
      deletedAt: null,
    });

    const doc = await ref.get();
    return NextResponse.json({ folder: { id: ref.id, ...doc.data() } }, { status: 201 });
  } catch (err) {
    console.error('POST folder error:', err);
    return NextResponse.json({ error: 'Failed to create folder' }, { status: 500 });
  }
}
