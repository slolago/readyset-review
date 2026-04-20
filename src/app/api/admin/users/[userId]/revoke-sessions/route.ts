import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-helpers';
import { getAdminAuth } from '@/lib/firebase-admin';

interface RouteParams { params: { userId: string } }

/**
 * POST /api/admin/users/[userId]/revoke-sessions
 *
 * Standalone revoke — kicks the user's active Firebase refresh tokens without
 * toggling their disabled flag (that's what PATCH /api/admin/users/[userId]
 * does via { disabled: true }).
 *
 * Phase 45 / ACCESS-05.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request);
  if (!admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  if (params.userId === admin.id) {
    return NextResponse.json({ error: 'Cannot revoke your own sessions' }, { status: 400 });
  }

  try {
    await getAdminAuth().revokeRefreshTokens(params.userId);
    return NextResponse.json({ success: true, hadAuthRecord: true });
  } catch (err) {
    // Invited-only users never created a Firebase Auth record — revoke is a no-op
    console.error('revoke-sessions error (may be invited-only user):', err);
    return NextResponse.json({ success: true, hadAuthRecord: false });
  }
}
