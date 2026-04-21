import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';

interface RouteParams { params: { userId: string } }

/**
 * GET /api/admin/users/[userId]
 *
 * Returns user detail + every project they own or collaborate on.
 * Used by the admin user drawer.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const db = getAdminDb();
    const uDoc = await db.collection('users').doc(params.userId).get();
    if (!uDoc.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    const user = { id: uDoc.id, ...uDoc.data() };

    // All projects in the system — walk once in memory to find membership
    const projectsSnap = await db.collection('projects').get();
    const owned: any[] = [];
    const collaborating: any[] = [];
    for (const d of projectsSnap.docs) {
      const p = { id: d.id, ...d.data() } as any;
      if (p.ownerId === params.userId) {
        owned.push({ id: p.id, name: p.name, color: p.color, collaboratorCount: (p.collaborators || []).length });
      } else if (Array.isArray(p.collaborators)) {
        const entry = p.collaborators.find((c: any) => c.userId === params.userId);
        if (entry) {
          collaborating.push({ id: p.id, name: p.name, color: p.color, role: entry.role ?? 'editor' });
        }
      }
    }

    // Cheap stats: comments authored (by user id or matching email), assets uploaded
    let commentsAuthored = 0;
    try {
      const byId = await db.collection('comments').where('userId', '==', params.userId).get();
      commentsAuthored = byId.size;
    } catch (err) {
      console.error('[GET /api/admin/users/[userId]] comment count query failed', err);
    }
    let assetsUploaded = 0;
    try {
      const s = await db.collection('assets').where('uploadedBy', '==', params.userId).get();
      assetsUploaded = s.size;
    } catch (err) {
      console.error('[GET /api/admin/users/[userId]] asset count query failed', err);
    }

    return NextResponse.json({
      user,
      ownedProjects: owned,
      collaboratingProjects: collaborating,
      stats: { commentsAuthored, assetsUploaded },
    });
  } catch (err) {
    console.error('admin user GET error:', err);
    return NextResponse.json({ error: 'Failed to load user' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users/[userId]
 *
 * Update disabled flag (suspend/reactivate) or role. Role changes go through
 * the existing PUT /api/admin/users endpoint; this handler accepts the same
 * shape for convenience and supports partial updates.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (typeof body.disabled === 'boolean') updates.disabled = body.disabled;
    if (body.role !== undefined) {
      if (!['admin', 'manager', 'editor', 'viewer'].includes(body.role)) {
        return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
      }
      if (params.userId === admin.id) {
        return NextResponse.json({ error: 'Cannot change your own role' }, { status: 400 });
      }
      updates.role = body.role;
    }
    if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    if (updates.disabled && params.userId === admin.id) {
      return NextResponse.json({ error: 'Cannot suspend yourself' }, { status: 400 });
    }

    const db = getAdminDb();
    await db.collection('users').doc(params.userId).update(updates);

    // When suspending, also revoke any active Firebase Auth session tokens so
    // the user is kicked out on next request. No-op if they have no Auth record.
    if (updates.disabled === true) {
      try {
        await getAdminAuth().revokeRefreshTokens(params.userId);
        await getAdminAuth().updateUser(params.userId, { disabled: true });
      } catch (err) {
        // user may not have an Auth record (invited-only) — non-fatal
        console.error('[PATCH /api/admin/users/[userId]] revoke/disable auth failed (may be invited-only)', err);
      }
    }
    if (updates.disabled === false) {
      try { await getAdminAuth().updateUser(params.userId, { disabled: false }); } catch (err) {
        console.error('[PATCH /api/admin/users/[userId]] reactivate auth user failed', err);
      }
    }

    return NextResponse.json({ success: true, updates });
  } catch (err) {
    console.error('admin user PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}
