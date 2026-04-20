import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';
import {
  canResolveComment,
  canEditComment,
  canDeleteComment,
} from '@/lib/permissions';
import type { Project, Comment } from '@/types';

interface RouteParams {
  params: { commentId: string };
}

// Fields an author is allowed to modify on their own comment
const AUTHOR_UPDATABLE = ['text', 'inPoint', 'outPoint', 'timestamp', 'annotation'];
// Fields any project member can modify (resolved state is collaborative)
const PROJECT_UPDATABLE = ['resolved'];

async function loadProject(projectId: string): Promise<Project | null> {
  const db = getAdminDb();
  const doc = await db.collection('projects').doc(projectId).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as Project;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const doc = await db.collection('comments').doc(params.commentId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const comment = { id: doc.id, ...doc.data() } as Comment;
    const project = await loadProject(comment.projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const rawUpdates = await request.json();

    // Whitelist per permission:
    //   PROJECT_UPDATABLE keys require canResolveComment (any project member)
    //   AUTHOR_UPDATABLE keys require canEditComment (author or admin)
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(rawUpdates)) {
      if (PROJECT_UPDATABLE.includes(key) && canResolveComment(user, project)) {
        updates[key] = value;
      } else if (AUTHOR_UPDATABLE.includes(key) && canEditComment(user, project, comment)) {
        updates[key] = value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No updatable fields provided or insufficient permission' },
        { status: 403 }
      );
    }

    await db.collection('comments').doc(params.commentId).update(updates);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Comment update error:', err);
    return NextResponse.json({ error: 'Failed to update comment' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const db = getAdminDb();
    const doc = await db.collection('comments').doc(params.commentId).get();
    if (!doc.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const comment = { id: doc.id, ...doc.data() } as Comment;
    const project = await loadProject(comment.projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (!canDeleteComment(user, project, comment)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.collection('comments').doc(params.commentId).delete();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Comment delete error:', err);
    return NextResponse.json({ error: 'Failed to delete comment' }, { status: 500 });
  }
}
