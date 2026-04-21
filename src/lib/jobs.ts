/**
 * Firestore helpers for the generalized `jobs` collection (Phase 60).
 * Server-only — uses firebase-admin. Do not import from client components.
 *
 * Covers probe / sprite / thumbnail / export job lifecycles with a uniform
 * status machine: queued → running → ready | failed. See src/lib/exports.ts
 * for the export-specific wrapper that maps the legacy `encoding` status
 * onto `running`.
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import type { Job, JobType, ExportFormat } from '@/types';

const COLLECTION = 'jobs';

export interface CreateJobInput {
  type: JobType;
  assetId: string;
  projectId: string;
  userId: string;
  // export-only (optional)
  format?: ExportFormat;
  inPoint?: number;
  outPoint?: number;
  filename?: string;
}

export async function createJob(input: CreateJobInput): Promise<string> {
  const db = getAdminDb();
  const payload: Record<string, unknown> = {
    type: input.type,
    assetId: input.assetId,
    projectId: input.projectId,
    userId: input.userId,
    status: 'queued',
    attempt: 1,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (input.format !== undefined) payload.format = input.format;
  if (input.inPoint !== undefined) payload.inPoint = input.inPoint;
  if (input.outPoint !== undefined) payload.outPoint = input.outPoint;
  if (input.filename !== undefined) payload.filename = input.filename;
  const ref = await db.collection(COLLECTION).add(payload);
  return ref.id;
}

export async function updateJob(jobId: string, patch: Partial<Job>): Promise<void> {
  const db = getAdminDb();
  // Drop id — never written back. Signed URL is transient, never stored.
  const { id: _id, signedUrl: _s, ...rest } = patch as Partial<Job> & { id?: string };
  void _id; void _s;
  await db.collection(COLLECTION).doc(jobId).update(rest as Record<string, unknown>);
}

export async function getJob(jobId: string): Promise<Job | null> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTION).doc(jobId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as Job;
}

export async function listJobsForAsset(assetId: string, max = 20): Promise<Job[]> {
  const db = getAdminDb();
  const snap = await db.collection(COLLECTION)
    .where('assetId', '==', assetId)
    .orderBy('createdAt', 'desc')
    .limit(max)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Job));
}
