/**
 * Version-group helpers — server-only.
 *
 * Centralizes the legacy-root fallback: older Asset docs may have been written
 * before `versionGroupId` was required, so the root of a legacy stack won't
 * match a `where('versionGroupId', '==', groupId)` query. Every route that
 * mutates or reads a version group MUST go through these helpers so the
 * legacy-root inclusion logic lives in exactly one place.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';

export interface GroupMember {
  id: string;
  version: number;
  data: Record<string, unknown>;
}

/**
 * Fetch all members of a version group, including the root asset even if it
 * lacks a `versionGroupId` field (legacy docs). Returns members sorted by
 * ascending version.
 */
export async function fetchGroupMembers(
  db: Firestore,
  groupId: string
): Promise<GroupMember[]> {
  const snap = await db.collection('assets').where('versionGroupId', '==', groupId).get();

  const members: GroupMember[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      version: typeof data.version === 'number' ? data.version : 1,
      data,
    };
  });

  // Legacy-root inclusion: if no member has id === groupId, fetch the root doc
  // directly and append it if it exists.
  if (!members.some((m) => m.id === groupId)) {
    const rootDoc = await db.collection('assets').doc(groupId).get();
    if (rootDoc.exists) {
      const data = rootDoc.data() as Record<string, unknown>;
      members.push({
        id: rootDoc.id,
        version: typeof data.version === 'number' ? data.version : 1,
        data,
      });
    }
  }

  members.sort((a, b) => a.version - b.version);
  return members;
}

/**
 * Transaction-aware variant of fetchGroupMembers. All reads go through the
 * provided Transaction so they participate in the tx's read set. Callers MUST
 * invoke this before any tx.update()/tx.set()/tx.delete() (Firestore rule:
 * all reads before any writes inside a transaction).
 */
export async function fetchGroupMembersTx(
  db: Firestore,
  tx: Transaction,
  groupId: string
): Promise<GroupMember[]> {
  const query = db.collection('assets').where('versionGroupId', '==', groupId);
  const snap = await tx.get(query);

  const members: GroupMember[] = snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      version: typeof data.version === 'number' ? data.version : 1,
      data,
    };
  });

  if (!members.some((m) => m.id === groupId)) {
    const rootDoc = await tx.get(db.collection('assets').doc(groupId));
    if (rootDoc.exists) {
      const data = rootDoc.data() as Record<string, unknown>;
      members.push({
        id: rootDoc.id,
        version: typeof data.version === 'number' ? data.version : 1,
        data,
      });
    }
  }

  members.sort((a, b) => a.version - b.version);
  return members;
}

/**
 * Resolve the canonical group id for an asset. For legacy docs with no
 * `versionGroupId`, falls back to the asset's own id (standalone).
 */
export function resolveGroupId(
  asset: { versionGroupId?: string } | Record<string, unknown>,
  assetId: string
): string {
  const vgid = (asset as { versionGroupId?: unknown }).versionGroupId;
  return typeof vgid === 'string' && vgid ? vgid : assetId;
}
