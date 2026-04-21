import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const raw = fs.readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
const env = {};
for (const line of raw.split('\n')) {
  const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
  if (!m) continue;
  let v = m[2];
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  env[m[1]] = v;
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
});

const db = admin.firestore();
const snap = await db.collection('assets').where('type', '==', 'video').get();
const buckets = { hasV2: 0, hasLegacy: 0, none: 0, deleted: 0 };
const legacyPaths = new Set();
const noneIds = [];
for (const d of snap.docs) {
  const data = d.data();
  if (data.deletedAt) { buckets.deleted++; continue; }
  const p = data.spriteStripGcsPath;
  if (!p) { buckets.none++; noneIds.push(d.id); }
  else if (p.includes('sprite-v2.jpg')) buckets.hasV2++;
  else { buckets.hasLegacy++; legacyPaths.add(p.split('/').pop()); }
}
console.log(`Videos: ${snap.size}`);
console.log(`  has sprite-v2.jpg: ${buckets.hasV2}`);
console.log(`  has legacy sprite path: ${buckets.hasLegacy}`);
console.log(`  no sprite path: ${buckets.none}`);
console.log(`  soft-deleted: ${buckets.deleted}`);
if (legacyPaths.size) console.log(`  legacy path suffixes: ${Array.from(legacyPaths).join(', ')}`);
if (noneIds.length && noneIds.length < 20) console.log(`  asset ids without sprite: ${noneIds.join(', ')}`);

await admin.app().delete();
