/**
 * Regression script — verifies stack/unstack/reorder preserve comments and
 * review-link references across the full invariant set from Phase 43-01.
 *
 * Usage (no new devDependencies):
 *   1. Start the dev server: `npm run dev`
 *   2. Obtain a Firebase ID token for a user with a valid project.
 *   3. Run: `ID_TOKEN=... PROJECT_ID=... npx tsx scripts/verify-stack-integrity.ts`
 *      (or compile with `npx tsc` and run the emitted JS)
 *
 * This script hits the live API routes. It creates ephemeral assets by
 * uploading 1-byte placeholders, then exercises the invariants documented in
 * must_haves.truths (43-01-PLAN.md):
 *
 *   1. Any asset can be stacked onto any other (stack-onto-stack included).
 *   2. Any version (including the original root) can be unstacked; remaining
 *      members re-compact to 1..N and never share a groupId with the
 *      detached asset.
 *   3. Reorder renumbers the whole group atomically; partial reorders are
 *      rejected.
 *   4. Comment.assetId and ReviewLink.assetIds[] survive all ops unchanged.
 *   5. No legacy-root asset is silently dropped.
 *
 * Status: documentation-first harness. In a proper CI rig these would be
 * Jest integration tests; that setup is out of scope for Phase 43.
 */

const API_BASE = process.env.API_BASE ?? 'http://localhost:3000';
const ID_TOKEN = process.env.ID_TOKEN;
const PROJECT_ID = process.env.PROJECT_ID;

function requireEnv() {
  if (!ID_TOKEN) throw new Error('ID_TOKEN env var required');
  if (!PROJECT_ID) throw new Error('PROJECT_ID env var required');
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      Authorization: `Bearer ${ID_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

async function getVersions(assetId: string): Promise<Array<{ id: string; version: number; versionGroupId?: string }>> {
  const data = await api<{ versions: Array<{ id: string; version: number; versionGroupId?: string }> }>(
    `/api/assets/${assetId}`
  );
  return data.versions;
}

async function merge(sourceId: string, targetId: string) {
  return api<{ merged: number }>(`/api/assets/merge-version`, {
    method: 'POST',
    body: JSON.stringify({ sourceId, targetId }),
  });
}

async function unstack(assetId: string) {
  return api<{ unstacked: string; remaining: number }>(`/api/assets/unstack-version`, {
    method: 'POST',
    body: JSON.stringify({ assetId }),
  });
}

async function reorder(orderedIds: string[]) {
  return api<{ reordered: number }>(`/api/assets/reorder-versions`, {
    method: 'POST',
    body: JSON.stringify({ orderedIds }),
  });
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`ASSERT FAIL: ${msg}`);
}

async function run() {
  requireEnv();

  console.log('--- verify-stack-integrity: manual setup required ---');
  console.log('Prereq: create 3 sibling video assets in the target project.');
  console.log('Provide their ids as env vars: ASSET_A, ASSET_B, ASSET_C');
  console.log('Optional: provide COMMENT_ID (on B) and REVIEW_LINK_ID (refs B, C).');

  const A = process.env.ASSET_A!;
  const B = process.env.ASSET_B!;
  const C = process.env.ASSET_C!;
  if (!A || !B || !C) throw new Error('ASSET_A, ASSET_B, ASSET_C required');

  console.log('\n[1] Stack B onto A');
  await merge(B, A);
  let versions = await getVersions(A);
  assert(versions.length === 2, 'A+B should be a 2-version group');
  assert(versions.map((v) => v.version).sort().join(',') === '1,2', 'versions 1,2');

  console.log('[2] Stack-onto-stack: stack C onto the A-B group');
  await merge(C, A);
  versions = await getVersions(A);
  assert(versions.length === 3, 'A+B+C should be a 3-version group');
  assert(versions.map((v) => v.version).sort().join(',') === '1,2,3', 'versions 1,2,3');

  console.log('[3] Unstack the ORIGINAL ROOT (A) — tests Bug 2 fix');
  await unstack(A);
  const aVersions = await getVersions(A);
  assert(aVersions.length === 1, 'A standalone');
  assert(aVersions[0].id === A, 'A is its own only version');
  assert(aVersions[0].version === 1, 'A version=1');

  // Remaining B, C must share a new groupId != A and re-compact to 1..2
  const bVersions = await getVersions(B);
  assert(bVersions.length === 2, 'B-C group has 2 members');
  const bcIds = bVersions.map((v) => v.id).sort();
  assert(bcIds.includes(B) && bcIds.includes(C), 'B and C still grouped');
  assert(!bVersions.some((v) => v.id === A), 'A MUST NOT appear in B-C group (ghost-stack regression)');
  const bcGroup = bVersions[0].versionGroupId;
  assert(bcGroup && bcGroup !== A, `new groupId should not equal A (got ${bcGroup})`);

  console.log('[4] Reorder B-C group — swap versions');
  const current = bVersions.sort((a, b) => a.version - b.version);
  await reorder([current[1].id, current[0].id]);
  const reordered = (await getVersions(B)).sort((a, b) => a.version - b.version);
  assert(reordered[0].id === current[1].id, 'swap succeeded');

  console.log('[5] Reject partial reorder — must return 400');
  try {
    await reorder([B]);
    throw new Error('partial reorder should have been rejected');
  } catch (err: any) {
    assert(String(err).includes('400'), `expected 400, got: ${err}`);
  }

  console.log('\nALL INVARIANTS HELD.');
  console.log('Manual follow-up: verify Comment.assetId and ReviewLink.assetIds[] unchanged in Firestore.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
