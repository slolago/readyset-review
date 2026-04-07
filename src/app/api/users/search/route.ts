import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { getAdminDb } from '@/lib/firebase-admin';

// GET /api/users/search?q=alice&exclude=uid1,uid2
// Returns { users: [{ id, name, email }] } — prefix search on name and email fields.
// Note: Firestore range queries are case-sensitive. The name query uses the raw query string,
// so "alice" matches "alice" but not "Alice". This is a known v1 limitation.
export async function GET(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') || '').trim();
  const excludeIds = new Set(
    (searchParams.get('exclude') || '').split(',').filter(Boolean)
  );

  // Require at least 2 characters to limit Firestore reads
  if (q.length < 2) return NextResponse.json({ users: [] });

  const qLower = q.toLowerCase();
  const nameEnd = q + '\uf8ff';
  const emailEnd = qLower + '\uf8ff';

  try {
    const db = getAdminDb();

    // Run name and email prefix queries in parallel
    const [nameSnap, emailSnap] = await Promise.all([
      db
        .collection('users')
        .orderBy('name')
        .where('name', '>=', q)
        .where('name', '<', nameEnd)
        .limit(8)
        .get(),
      db
        .collection('users')
        .orderBy('email')
        .where('email', '>=', qLower)
        .where('email', '<', emailEnd)
        .limit(8)
        .get(),
    ]);

    const seen = new Set<string>();
    const users: { id: string; name: string; email: string }[] = [];

    for (const doc of [...nameSnap.docs, ...emailSnap.docs]) {
      if (seen.has(doc.id)) continue;
      if (excludeIds.has(doc.id)) continue;
      seen.add(doc.id);
      const d = doc.data() as { name?: string; email?: string };
      users.push({ id: doc.id, name: d.name || '', email: d.email || '' });
    }

    return NextResponse.json({ users: users.slice(0, 8) });
  } catch (err) {
    console.error('[users/search] error:', err);
    return NextResponse.json({ error: 'Failed to search users' }, { status: 500 });
  }
}
