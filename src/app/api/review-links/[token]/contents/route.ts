import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, getAdminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { generateReadSignedUrl } from '@/lib/gcs';

interface RouteParams { params: { token: string } }

/**
 * GET /api/review-links/[token]/contents
 *
 * Owner-only. Returns the raw contents arrays with names/thumbnails resolved.
 * Used by the contents editor UI — distinct from the public GET which applies
 * version grouping and signed URL generation for rendering.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const db = getAdminDb();
    const snap = await db.collection('reviewLinks').doc(params.token).get();
    if (!snap.exists) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const link = snap.data() as any;
    if (link.createdBy !== uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const assetIds: string[] = Array.isArray(link.assetIds) ? link.assetIds : [];
    const folderIds: string[] = Array.isArray(link.folderIds) ? link.folderIds : [];

    // Legacy folderId migration hint — surface it as a single-element folders array
    // so the editor can show it and let the user edit it.
    const effectiveFolderIds = folderIds.length
      ? folderIds
      : (link.folderId ? [link.folderId] : []);

    // Resolve folder names (chunk for 'in' query cap of 30)
    const folders: any[] = [];
    for (let i = 0; i < effectiveFolderIds.length; i += 30) {
      const chunk = effectiveFolderIds.slice(i, i + 30);
      if (!chunk.length) break;
      const fs = await db.collection('folders').where('__name__', 'in', chunk).get();
      for (const d of fs.docs) folders.push({ id: d.id, ...d.data() });
    }
    // Preserve missing ones as tombstones
    const gotFolderIds = new Set(folders.map((f) => f.id));
    for (const id of effectiveFolderIds) {
      if (!gotFolderIds.has(id)) folders.push({ id, _deleted: true });
    }

    // Resolve assets (name, thumbnail only — no full signed URLs needed for editor)
    const assets: any[] = [];
    await Promise.all(
      assetIds.map(async (id) => {
        const d = await db.collection('assets').doc(id).get();
        if (!d.exists) { assets.push({ id, _deleted: true }); return; }
        const a = { id: d.id, ...d.data() } as any;
        if (a.thumbnailGcsPath) {
          try { a.thumbnailSignedUrl = await generateReadSignedUrl(a.thumbnailGcsPath); } catch {}
        }
        assets.push(a);
      })
    );

    return NextResponse.json({
      assetIds,
      folderIds: effectiveFolderIds,
      legacyFolderId: link.folderId ?? null,
      assets,
      folders,
      projectId: link.projectId,
    });
  } catch (err) {
    console.error('review-link contents GET error:', err);
    return NextResponse.json({ error: 'Failed to load contents' }, { status: 500 });
  }
}

/**
 * PATCH /api/review-links/[token]/contents
 *
 * Body: { addAssetIds?, removeAssetIds?, addFolderIds?, removeFolderIds? }
 *
 * Edits the editable-contents arrays on a review link. Only the creator can edit.
 * If the link was created with the legacy `folderId` scope, the first edit migrates
 * it to the arrays-based model (absorbs folderId into folderIds[]).
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const decoded = await getAdminAuth().verifyIdToken(authHeader.slice(7));
    const uid = decoded.uid;

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

    const addAssetIds = Array.isArray(body.addAssetIds) ? body.addAssetIds.filter((x: unknown) => typeof x === 'string') : [];
    const removeAssetIds = Array.isArray(body.removeAssetIds) ? body.removeAssetIds.filter((x: unknown) => typeof x === 'string') : [];
    const addFolderIds = Array.isArray(body.addFolderIds) ? body.addFolderIds.filter((x: unknown) => typeof x === 'string') : [];
    const removeFolderIds = Array.isArray(body.removeFolderIds) ? body.removeFolderIds.filter((x: unknown) => typeof x === 'string') : [];

    if (!addAssetIds.length && !removeAssetIds.length && !addFolderIds.length && !removeFolderIds.length) {
      return NextResponse.json({ error: 'No changes' }, { status: 400 });
    }

    const db = getAdminDb();
    const ref = db.collection('reviewLinks').doc(params.token);

    // Fetch the link first (outside txn) to get projectId for validation
    const initialSnap = await ref.get();
    if (!initialSnap.exists) return NextResponse.json({ error: 'Review link not found' }, { status: 404 });
    const initialLink = initialSnap.data() as any;
    if (initialLink.createdBy !== uid) {
      return NextResponse.json({ error: 'Only the link creator can edit its contents' }, { status: 403 });
    }
    const projectId = initialLink.projectId as string;

    // Validate additions belong to this project (batched reads outside the txn for scalability)
    if (addAssetIds.length) {
      const assetDocs = await Promise.all(addAssetIds.map((id: string) => db.collection('assets').doc(id).get()));
      for (const d of assetDocs) {
        if (!d.exists) return NextResponse.json({ error: `Asset ${d.id} not found` }, { status: 404 });
        const a = d.data() as any;
        if (a.projectId !== projectId) return NextResponse.json({ error: 'Items must belong to the link\u2019s project' }, { status: 400 });
      }
    }
    if (addFolderIds.length) {
      const folderDocs = await Promise.all(addFolderIds.map((id: string) => db.collection('folders').doc(id).get()));
      for (const d of folderDocs) {
        if (!d.exists) return NextResponse.json({ error: `Folder ${d.id} not found` }, { status: 404 });
        const f = d.data() as any;
        if (f.projectId !== projectId) return NextResponse.json({ error: 'Items must belong to the link\u2019s project' }, { status: 400 });
      }
    }

    const result = await db.runTransaction(async (tx) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('NOT_FOUND');
      const link = doc.data() as any;
      if (link.createdBy !== uid) throw new Error('FORBIDDEN');

      // Current arrays (migrate legacy folderId → folderIds[] on first edit)
      let currentAssetIds: string[] = Array.isArray(link.assetIds) ? [...link.assetIds] : [];
      let currentFolderIds: string[] = Array.isArray(link.folderIds) ? [...link.folderIds] : [];
      const migrateLegacyFolder = link.folderId && !currentFolderIds.length && !currentAssetIds.length;
      if (migrateLegacyFolder) currentFolderIds = [link.folderId];

      // Apply changes (set-style to dedupe)
      const assetSet = new Set(currentAssetIds);
      for (const id of addAssetIds) assetSet.add(id);
      for (const id of removeAssetIds) assetSet.delete(id);

      const folderSet = new Set(currentFolderIds);
      for (const id of addFolderIds) folderSet.add(id);
      for (const id of removeFolderIds) folderSet.delete(id);

      const nextAssetIds = Array.from(assetSet);
      const nextFolderIds = Array.from(folderSet);

      if (nextAssetIds.length > 200) throw new Error('TOO_MANY_ASSETS');
      if (nextFolderIds.length > 50) throw new Error('TOO_MANY_FOLDERS');

      const update: Record<string, unknown> = {
        assetIds: nextAssetIds.length ? nextAssetIds : null,
        folderIds: nextFolderIds.length ? nextFolderIds : null,
        updatedAt: FieldValue.serverTimestamp(),
      };
      // Once migrated to arrays, clear legacy folderId to avoid double-counting
      if (migrateLegacyFolder) update.folderId = null;

      tx.update(ref, update);
      return { assetIds: nextAssetIds, folderIds: nextFolderIds };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Review link not found' }, { status: 404 });
    if (msg === 'FORBIDDEN') return NextResponse.json({ error: 'Only the link creator can edit its contents' }, { status: 403 });
    if (msg === 'TOO_MANY_ASSETS') return NextResponse.json({ error: 'Maximum 200 assets per link' }, { status: 400 });
    if (msg === 'TOO_MANY_FOLDERS') return NextResponse.json({ error: 'Maximum 50 folders per link' }, { status: 400 });
    console.error('review-link contents PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update review link contents' }, { status: 500 });
  }
}
