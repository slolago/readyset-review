import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

/**
 * POST /api/admin/migrate-folder-paths
 * One-time migration: fills in the `path` array for any folder that has
 * parentId set but is missing the `path` field (created before path was stored).
 */
export async function POST(request: NextRequest) {

  try {
    const db = getAdminDb();
    const snap = await db.collection('folders').get();
    const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    // Build a lookup map
    const byId = new Map<string, any>();
    for (const f of all) byId.set(f.id, f);

    // Compute the correct path for a folder by walking parentId chain
    const computePath = (folderId: string, visited = new Set<string>()): string[] => {
      if (visited.has(folderId)) return []; // cycle guard
      visited.add(folderId);
      const folder = byId.get(folderId);
      if (!folder || !folder.parentId) return [];
      const parentPath = computePath(folder.parentId, visited);
      return [...parentPath, folder.parentId];
    };

    const updates: { id: string; path: string[] }[] = [];
    for (const folder of all) {
      const correctPath = computePath(folder.id);
      const storedPath: string[] = folder.path ?? [];
      // Update if path is missing or different
      if (JSON.stringify(storedPath) !== JSON.stringify(correctPath)) {
        updates.push({ id: folder.id, path: correctPath });
      }
    }

    // Apply updates in batches of 500
    const BATCH_SIZE = 500;
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = db.batch();
      for (const { id, path } of updates.slice(i, i + BATCH_SIZE)) {
        batch.update(db.collection('folders').doc(id), { path });
      }
      await batch.commit();
    }

    return NextResponse.json({
      message: `Migration complete. Updated ${updates.length} of ${all.length} folders.`,
      updated: updates.map((u) => ({ id: u.id, path: u.path })),
    });
  } catch (err) {
    console.error('migrate-folder-paths error:', err);
    return NextResponse.json({ error: 'Migration failed' }, { status: 500 });
  }
}
