/**
 * Mint a new API key for a user. Prints the plaintext key ONCE — it is not
 * recoverable later, only revocable.
 *
 * Usage:
 *   node scripts/create-api-key.mjs --email you@example.com --name "Zapier — folders"
 *   node scripts/create-api-key.mjs --uid <firebase-uid> --name "Zapier — folders"
 *
 * List existing keys for a user:
 *   node scripts/create-api-key.mjs --list --email you@example.com
 *
 * Revoke a key:
 *   node scripts/create-api-key.mjs --revoke <keyDocId>
 */

import admin from 'firebase-admin';
import crypto from 'node:crypto';
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

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        args[key] = true;
      } else {
        args[key] = next;
        i++;
      }
    }
  }
  return args;
}

const env = loadEnv();
const projectId = env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = (env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n');

if (!projectId || !clientEmail || !privateKey) {
  throw new Error('Firebase admin credentials missing from .env.local');
}

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
});

const db = admin.firestore();
const args = parseArgs(process.argv.slice(2));

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex');
}

async function resolveUid(a) {
  if (a.uid) return a.uid;
  if (!a.email) throw new Error('--email or --uid required');
  const snap = await db
    .collection('users')
    .where('email', '==', a.email)
    .limit(1)
    .get();
  if (snap.empty) throw new Error(`No user found with email ${a.email}`);
  return snap.docs[0].id;
}

// ── LIST ────────────────────────────────────────────────────────────────────
if (args.list) {
  const uid = await resolveUid(args);
  const snap = await db.collection('apiKeys').where('userId', '==', uid).get();
  console.log(`API keys for uid=${uid}: ${snap.size}`);
  for (const d of snap.docs) {
    const data = d.data();
    const created = data.createdAt?.toDate?.().toISOString() ?? '—';
    const lastUsed = data.lastUsedAt?.toDate?.().toISOString() ?? 'never';
    const status = data.revokedAt ? 'REVOKED' : 'active';
    console.log(`  ${d.id}  [${status}]  name="${data.name}"  created=${created}  lastUsed=${lastUsed}`);
  }
  process.exit(0);
}

// ── REVOKE ──────────────────────────────────────────────────────────────────
if (args.revoke && typeof args.revoke === 'string') {
  const ref = db.collection('apiKeys').doc(args.revoke);
  const doc = await ref.get();
  if (!doc.exists) {
    console.error(`No apiKeys doc with id=${args.revoke}`);
    process.exit(1);
  }
  await ref.update({ revokedAt: admin.firestore.FieldValue.serverTimestamp() });
  console.log(`Revoked ${args.revoke}`);
  process.exit(0);
}

// ── CREATE ──────────────────────────────────────────────────────────────────
const uid = await resolveUid(args);
const name = args.name || 'unnamed';

// Verify the user doc exists (gives a clear error if the uid is bogus).
const userDoc = await db.collection('users').doc(uid).get();
if (!userDoc.exists) throw new Error(`users/${uid} does not exist`);

// Generate 32 random bytes → base64url → rsk_<43 chars>
const plaintext = `rsk_${crypto.randomBytes(32).toString('base64url')}`;
const hash = sha256Hex(plaintext);

await db.collection('apiKeys').doc(hash).set({
  userId: uid,
  name,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  lastUsedAt: null,
  revokedAt: null,
});

console.log('');
console.log('API key created. SAVE IT NOW — it will never be shown again.');
console.log('');
console.log(`  key:  ${plaintext}`);
console.log(`  id:   ${hash}`);
console.log(`  user: ${userDoc.data().email ?? uid}`);
console.log(`  name: ${name}`);
console.log('');
console.log('Use in HTTP requests:');
console.log(`  X-API-Key: ${plaintext}`);
console.log('');
