/**
 * Backfill `collaboratorIds` on every pre-v2.1 project document.
 *
 * Phase 67 (PERF-01) denormalized collaborator UIDs onto project docs so
 * `/api/projects` and `/api/stats` can use an indexed `array-contains` query
 * instead of scanning the entire `projects` collection. Projects created
 * before that change have `collaboratorIds` undefined — their owner's queries
 * see them via `ownerId==` but any non-owner collaborator queries miss them
 * entirely until this backfill runs.
 *
 * Logic: for each project, derive `want = collaborators.map(c => c.userId)`.
 * Write only when the stored array doesn't already match (order-insensitive).
 * Safe to re-run — a second pass should report 0 updates.
 *
 * Usage: node scripts/backfill-collaborator-ids.mjs
 */

import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(projectRoot, '.env.local');
  const raw = fs.readFileSync(envPath, 'utf8');
  const out = {};
  for (const line of raw.split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv();
const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Firebase admin credentials missing from .env.local');
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();

console.log(`Scanning projects in ${projectId}...`);
const projectsSnap = await db.collection('projects').get();
console.log(`  ${projectsSnap.size} project docs\n`);

function sameSet(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;
  const set = new Set(a);
  for (const v of b) if (!set.has(v)) return false;
  return true;
}

let toUpdate = 0;
let already = 0;
const BATCH_SIZE = 500; // Firestore batch limit
let batch = db.batch();
let batched = 0;

for (const doc of projectsSnap.docs) {
  const data = doc.data();
  const want = (data.collaborators || []).map((c) => c.userId).filter(Boolean);
  const have = data.collaboratorIds;
  if (sameSet(have, want)) {
    already++;
    continue;
  }
  batch.update(doc.ref, { collaboratorIds: want });
  batched++;
  toUpdate++;
  if (batched >= BATCH_SIZE) {
    await batch.commit();
    console.log(`  committed batch of ${batched}`);
    batch = db.batch();
    batched = 0;
  }
}
if (batched > 0) {
  await batch.commit();
  console.log(`  committed final batch of ${batched}`);
}

console.log(`\nDone. Updated ${toUpdate} projects; ${already} already had the correct collaboratorIds.`);

await admin.app().delete();
