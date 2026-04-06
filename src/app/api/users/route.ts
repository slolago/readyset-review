import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/users?ids=uid1,uid2,uid3
// Returns a name map: { users: { [uid]: { name, email } } }
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
  if (ids.length === 0) return NextResponse.json({ users: {} });

  // Cap at 30 to avoid abuse
  const safeIds = ids.slice(0, 30);

  try {
    const db = getAdminDb();
    const docs = await Promise.all(safeIds.map((id) => db.collection('users').doc(id).get()));
    const users: Record<string, { name: string; email: string }> = {};
    for (const doc of docs) {
      if (doc.exists) {
        const d = doc.data() as any;
        users[doc.id] = { name: d.name || d.email || doc.id, email: d.email || '' };
      }
    }
    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}
