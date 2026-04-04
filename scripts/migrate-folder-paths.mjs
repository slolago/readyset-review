/**
 * One-time migration: populate the `path` array on all folders that are missing it.
 * Run with: node scripts/migrate-folder-paths.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { createRequire } from 'module';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load .env.local manually
const envPath = resolve(__dirname, '../.env.local');
const envContent = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim();
}

// Find the service account key file
const keyFile = resolve(__dirname, '../frame-clone-7c8c8-firebase-adminsdk-fbsvc-950a04e4ee.json');
const serviceAccount = JSON.parse(readFileSync(keyFile, 'utf8'));

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const snap = await db.collection('folders').get();
const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));

console.log(`Found ${all.length} folders total`);

// Build lookup map
const byId = new Map();
for (const f of all) byId.set(f.id, f);

// Compute correct path by walking parentId chain
function computePath(folderId, visited = new Set()) {
  if (visited.has(folderId)) return [];
  visited.add(folderId);
  const folder = byId.get(folderId);
  if (!folder || !folder.parentId) return [];
  const parentPath = computePath(folder.parentId, visited);
  return [...parentPath, folder.parentId];
}

const updates = [];
for (const folder of all) {
  const correctPath = computePath(folder.id);
  const storedPath = folder.path ?? [];
  if (JSON.stringify(storedPath) !== JSON.stringify(correctPath)) {
    updates.push({ id: folder.id, name: folder.name, oldPath: storedPath, newPath: correctPath });
  }
}

console.log(`\nFolders needing update: ${updates.length}`);
for (const u of updates) {
  console.log(`  "${u.name}" (${u.id})`);
  console.log(`    old path: [${u.oldPath.join(', ')}]`);
  console.log(`    new path: [${u.newPath.join(', ')}]`);
}

if (updates.length === 0) {
  console.log('\nAll folders already have correct paths. Nothing to do.');
  process.exit(0);
}

console.log('\nApplying updates...');
const batch = db.batch();
for (const { id, newPath } of updates) {
  batch.update(db.collection('folders').doc(id), { path: newPath });
}
await batch.commit();
console.log(`Done! Updated ${updates.length} folders.`);
