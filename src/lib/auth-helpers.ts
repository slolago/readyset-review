import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from './firebase-admin';
import type { User } from '@/types';
import { platformRoleAtLeast, type PlatformRole } from './permissions';

export async function verifyAuthToken(
  request: NextRequest
): Promise<{ uid: string; email: string } | null> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const decoded = await getAdminAuth().verifyIdToken(token);
    return { uid: decoded.uid, email: decoded.email || '' };
  } catch {
    return null;
  }
}

/**
 * PERF-08 (Phase 69) — in-process cache for the user-doc Firestore read.
 *
 * Concurrent API calls on the same request (e.g. dashboard mount fires
 * /api/stats + /api/projects in parallel) would each re-read users/{uid}
 * from Firestore. This Map dedupes those reads across the serverless
 * invocation's lifetime.
 *
 * TTL is 30s — short enough that admin suspends propagate within that
 * window (documented tradeoff: a suspended user may still authenticate for
 * up to 30s after suspension), long enough to cover any realistic request
 * fan-out. We also only cache non-disabled users so the disabled check
 * always runs fresh on the first hit.
 */
const userCache = new Map<string, { user: User; exp: number }>();
const USER_CACHE_TTL_MS = 30 * 1000;

export function invalidateUserCache(uid: string): void {
  userCache.delete(uid);
}

export async function getAuthenticatedUser(
  request: NextRequest
): Promise<User | null> {
  const auth = await verifyAuthToken(request);
  if (!auth) return null;

  const cached = userCache.get(auth.uid);
  if (cached && Date.now() < cached.exp) {
    return cached.user;
  }

  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(auth.uid).get();
  if (!userDoc.exists) return null;

  const data = userDoc.data();
  if (!data) return null;
  if (data.disabled === true) {
    // Don't cache disabled users — ensures re-enable takes effect immediately
    // and a suspended user never lingers in cache.
    userCache.delete(auth.uid);
    return null;
  }

  const user = { id: userDoc.id, ...data } as User;
  userCache.set(auth.uid, { user, exp: Date.now() + USER_CACHE_TTL_MS });
  return user;
}

export async function requireAdmin(
  request: NextRequest
): Promise<User | null> {
  const user = await getAuthenticatedUser(request);
  if (!user || user.role !== 'admin') return null;
  return user;
}

export function getIdTokenFromRequest(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

/**
 * @deprecated Use `platformRoleAtLeast` from '@/lib/permissions' directly.
 */
export function roleAtLeast(user: User, minRole: PlatformRole): boolean {
  return platformRoleAtLeast(user, minRole);
}
