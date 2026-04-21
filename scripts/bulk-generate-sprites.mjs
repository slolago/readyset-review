/**
 * Bulk-trigger server-side sprite generation for every video asset that
 * doesn't yet have a v2 sprite.
 *
 * Pre-v2.0 videos had sprites generated client-side (via
 * /api/upload/thumbnail?type=sprite) or not at all, and Phase 60 only fires
 * sprite generation for NEW uploads. Existing videos fall back to on-demand
 * generation on first hover, which costs 5–30s the first time and loses the
 * result if the user moves away before it finishes.
 *
 * This script pre-generates all missing sprites by calling the deployed
 * /api/assets/[id]/generate-sprite endpoint with a valid bearer token.
 *
 * Auth: uses Firebase Admin SDK to mint a custom token for a given UID, then
 * exchanges it for an ID token via the Firebase Auth REST API. The UID must
 * belong to a user authorized for the project (platform admin or project
 * editor).
 *
 * Env required (.env.local):
 *   FIREBASE_ADMIN_PROJECT_ID
 *   FIREBASE_ADMIN_CLIENT_EMAIL
 *   FIREBASE_ADMIN_PRIVATE_KEY
 *   NEXT_PUBLIC_FIREBASE_API_KEY   (for token exchange)
 *
 * Usage:
 *   node scripts/bulk-generate-sprites.mjs \
 *     --as=<uid-of-admin-user> \
 *     --baseUrl=https://<deployment>.vercel.app \
 *     [--concurrency=3] [--dry-run]
 *
 * Prefer running against the deployed app (baseUrl=https://...), not
 * localhost, so GCS uploads + Firestore writes land in prod.
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const raw = fs.readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
  const env = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    env[m[1]] = v;
  }
  return env;
}

function parseArgs() {
  const out = { concurrency: 3, dryRun: false };
  for (const a of process.argv.slice(2)) {
    if (a.startsWith('--as=')) out.as = a.slice(5);
    else if (a.startsWith('--baseUrl=')) out.baseUrl = a.slice(10).replace(/\/$/, '');
    else if (a.startsWith('--concurrency=')) out.concurrency = parseInt(a.slice(14), 10);
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!out.as || !out.baseUrl) {
    console.error('Usage: node scripts/bulk-generate-sprites.mjs --as=<uid> --baseUrl=<https://...> [--concurrency=3] [--dry-run]');
    process.exit(1);
  }
  return out;
}

async function mintIdToken(env, uid) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
  const customToken = await admin.auth().createCustomToken(uid);
  const apiKey = env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY missing from .env.local');
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`token exchange failed (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.idToken;
}

const args = parseArgs();
const env = loadEnv();

console.log(`Minting ID token for UID ${args.as}...`);
const idToken = await mintIdToken(env, args.as);
console.log(`  → got ID token (${idToken.length} chars)`);

const db = admin.firestore();
console.log(`\nScanning video assets...`);
const snap = await db.collection('assets').where('type', '==', 'video').get();
const queue = [];
for (const d of snap.docs) {
  const data = d.data();
  if (data.deletedAt) continue;
  const p = data.spriteStripGcsPath;
  if (p && p.includes('sprite-v2.jpg')) continue;
  queue.push({ id: d.id, name: data.name, hasLegacy: !!p });
}
console.log(`  ${snap.size} total · ${queue.length} need sprite generation\n`);

if (args.dryRun) {
  console.log('Dry run — would trigger for:');
  for (const item of queue.slice(0, 10)) console.log(`  ${item.id}  ${item.name}`);
  if (queue.length > 10) console.log(`  … and ${queue.length - 10} more`);
  await admin.app().delete();
  process.exit(0);
}

let ok = 0, fail = 0;
async function dispatchOne(item) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${args.baseUrl}/api/assets/${item.id}/generate-sprite`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (res.ok) {
      ok++;
      console.log(`  ✓ ${item.name.slice(0, 60).padEnd(60)} ${Math.round((Date.now() - t0) / 1000)}s`);
    } else {
      fail++;
      const body = await res.text().catch(() => '');
      console.log(`  ✗ ${item.name.slice(0, 60).padEnd(60)} ${res.status} ${body.slice(0, 120)}`);
    }
  } catch (err) {
    fail++;
    console.log(`  ✗ ${item.name.slice(0, 60).padEnd(60)} ${err.message}`);
  }
}

// Concurrency-limited pool — Vercel's 60s function wall clock is the
// bottleneck per request, but the platform itself can run many in parallel.
const pool = new Set();
async function run() {
  for (const item of queue) {
    while (pool.size >= args.concurrency) {
      await Promise.race(pool);
    }
    const p = dispatchOne(item).finally(() => pool.delete(p));
    pool.add(p);
  }
  await Promise.all(pool);
}

console.log(`Triggering ${queue.length} sprite generations at concurrency ${args.concurrency}...\n`);
const started = Date.now();
await run();
console.log(`\nDone. ${ok} succeeded, ${fail} failed, in ${Math.round((Date.now() - started) / 1000)}s total.`);
console.log(`On next grid load, all ${ok} assets will have spriteSignedUrl served directly from the list endpoint cache.`);

await admin.app().delete();
