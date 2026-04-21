/**
 * URGENT backfill: set `deletedAt: null` on every asset + folder doc where
 * the field is absent.
 *
 * Phase 63 switched list endpoints to `.where('deletedAt', '==', null)` for
 * the new composite index. Firestore's `== null` matches EXPLICITLY-null
 * fields, not absent fields. Pre-v2.0 docs don't have the field at all →
 * they disappeared from list results once the composite indexes were
 * deployed (before deploy, the fallback-to-in-memory path still found them).
 *
 * Idempotent: only writes on docs where the field is `undefined`. Soft-
 * deleted docs (deletedAt === Timestamp) are left alone.
 *
 * Usage: node scripts/backfill-deleted-at-null.mjs
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
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();

async function backfillCollection(name) {
  console.log(`\nScanning ${name}...`);
  const snap = await db.collection(name).get();
  console.log(`  ${snap.size} total docs`);

  let toUpdate = 0;
  let already = 0;
  let softDeleted = 0;

  const BATCH_SIZE = 500;
  let batch = db.batch();
  let batched = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const v = data.deletedAt;
    if (v === undefined) {
      batch.update(doc.ref, { deletedAt: null });
      batched++;
      toUpdate++;
    } else if (v === null) {
      already++;
    } else {
      // Timestamp — genuinely soft-deleted, leave as-is
      softDeleted++;
    }

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

  console.log(`  Updated: ${toUpdate}`);
  console.log(`  Already had deletedAt=null: ${already}`);
  console.log(`  Soft-deleted (left alone): ${softDeleted}`);
  return { toUpdate, already, softDeleted };
}

console.log(`Backfilling deletedAt:null on ${env.FIREBASE_ADMIN_PROJECT_ID}`);
const a = await backfillCollection('assets');
const f = await backfillCollection('folders');

console.log(`\nTotal: ${a.toUpdate + f.toUpdate} docs fixed.`);
console.log('Refresh the browser — assets should be visible again.');

await admin.app().delete();
