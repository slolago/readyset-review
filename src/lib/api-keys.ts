/**
 * API key auth — used for programmatic access (Zapier, curl, automation scripts).
 *
 * Storage model:
 *   Firestore collection `apiKeys`, doc ID = SHA-256 hex of the full plaintext
 *   key. Fields: `userId`, `name`, `createdAt`, `lastUsedAt`, `revokedAt`.
 *
 *   Using the hash as the doc ID gives O(1) lookup on verify (no collection
 *   scan, no bcrypt work) while keeping plaintext keys out of Firestore —
 *   leaking a Firestore read doesn't leak usable credentials.
 *
 * Key format: `rsk_<43-char base64url>` — 32 bytes of entropy.
 *   - `rsk_` prefix (readyset key) makes leaked keys grep-able in logs/code.
 *   - base64url is URL/header-safe (no `+/=`), so users can paste without
 *     escaping.
 *
 * Shown ONCE at creation. We only store the hash, so we cannot recover the
 * plaintext later — revoke + re-create is the only path if the user loses it.
 */

import crypto from 'crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';

export const API_KEY_PREFIX = 'rsk_';

function sha256Hex(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Generate a new random API key (plaintext). Caller is responsible for storing the hash. */
export function generateApiKey(): string {
  // 32 random bytes → 43 chars base64url (no padding). Plenty of entropy.
  const raw = crypto.randomBytes(32).toString('base64url');
  return `${API_KEY_PREFIX}${raw}`;
}

/** Hash a plaintext key for Firestore storage / lookup. */
export function hashApiKey(plaintext: string): string {
  return sha256Hex(plaintext);
}

export interface ApiKeyRecord {
  userId: string;
  name: string;
  createdAt: Timestamp;
  lastUsedAt?: Timestamp | null;
  revokedAt?: Timestamp | null;
}

/**
 * Verify a plaintext key. Returns the owning userId if valid + unrevoked,
 * null otherwise. Also bumps `lastUsedAt` (fire-and-forget — don't block the
 * request on the write).
 */
export async function verifyApiKey(plaintext: string): Promise<string | null> {
  if (!plaintext || !plaintext.startsWith(API_KEY_PREFIX)) return null;
  const hash = hashApiKey(plaintext);

  const db = getAdminDb();
  const doc = await db.collection('apiKeys').doc(hash).get();
  if (!doc.exists) return null;

  const data = doc.data() as ApiKeyRecord | undefined;
  if (!data) return null;
  if (data.revokedAt) return null;

  // Fire-and-forget lastUsedAt update. A write failure here shouldn't block
  // the API call — the key is valid either way.
  doc.ref
    .update({ lastUsedAt: FieldValue.serverTimestamp() })
    .catch((err) => console.warn('[api-keys] lastUsedAt update failed', err));

  return data.userId;
}
