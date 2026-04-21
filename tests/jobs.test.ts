/**
 * Unit tests for src/lib/jobs.ts (Phase 60).
 *
 * Uses the in-memory Firestore mock. FieldValue.serverTimestamp() is stubbed
 * to a sentinel string since the mock doesn't resolve server timestamps.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockDb, type MockDb } from './helpers/firestore-mock';

let db: MockDb = createMockDb();

vi.mock('@/lib/firebase-admin', () => ({
  getAdminDb: () => db,
}));

vi.mock('firebase-admin/firestore', () => ({
  FieldValue: {
    serverTimestamp: () => '__server_timestamp__',
    delete: () => '__delete__',
  },
}));

// Import AFTER mocks are registered.
import { createJob, updateJob, getJob, listJobsForAsset } from '@/lib/jobs';

describe('src/lib/jobs.ts', () => {
  beforeEach(() => {
    db = createMockDb();
  });

  it('createJob writes a queued doc with attempt=1 + createdAt', async () => {
    const id = await createJob({
      type: 'probe',
      assetId: 'a1',
      projectId: 'p1',
      userId: 'u1',
    });
    expect(id).toBeTruthy();
    const stored = db.__store.get('jobs')!.get(id)!;
    expect(stored.type).toBe('probe');
    expect(stored.assetId).toBe('a1');
    expect(stored.projectId).toBe('p1');
    expect(stored.userId).toBe('u1');
    expect(stored.status).toBe('queued');
    expect(stored.attempt).toBe(1);
    expect(stored.createdAt).toBe('__server_timestamp__');
  });

  it('updateJob merges fields and strips id + signedUrl from the patch', async () => {
    const id = await createJob({
      type: 'probe', assetId: 'a1', projectId: 'p1', userId: 'u1',
    });
    await updateJob(id, {
      status: 'running',
      // intentionally passing id and signedUrl to confirm they're stripped
      id: 'SHOULD_NOT_WRITE',
      signedUrl: 'SHOULD_NOT_WRITE',
    } as any);
    const stored = db.__store.get('jobs')!.get(id)!;
    expect(stored.status).toBe('running');
    // Patch's `id` did not overwrite the doc key
    expect(stored.id).toBeUndefined();
    expect(stored.signedUrl).toBeUndefined();
    // Other fields preserved
    expect(stored.attempt).toBe(1);
  });

  it('getJob returns null when missing', async () => {
    const missing = await getJob('does-not-exist');
    expect(missing).toBeNull();
  });

  it('getJob returns the doc shape including id', async () => {
    const id = await createJob({
      type: 'sprite', assetId: 'a1', projectId: 'p1', userId: 'u1',
    });
    const got = await getJob(id);
    expect(got).not.toBeNull();
    expect(got!.id).toBe(id);
    expect(got!.type).toBe('sprite');
  });

  it('listJobsForAsset filters by assetId and respects max', async () => {
    await createJob({ type: 'probe', assetId: 'a1', projectId: 'p1', userId: 'u1' });
    await createJob({ type: 'sprite', assetId: 'a1', projectId: 'p1', userId: 'u1' });
    await createJob({ type: 'probe', assetId: 'a2', projectId: 'p1', userId: 'u1' });

    const all = await listJobsForAsset('a1', 20);
    expect(all).toHaveLength(2);
    expect(all.every((j) => j.assetId === 'a1')).toBe(true);

    const limited = await listJobsForAsset('a1', 1);
    expect(limited).toHaveLength(1);
  });
});
