import type { Prisma } from '@prisma/client';
import type { JsonValue } from '@prisma/client/runtime/library';

type Db = Prisma.TransactionClient;

export interface AuditEntry {
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  oldValue?: JsonValue | null;
  newValue?: JsonValue | null;
}

/** Trace une opération sensible (append-only, jamais mise à jour). */
export async function recordAudit(tx: Db, entry: AuditEntry): Promise<void> {
  await tx.auditLog.create({
    data: {
      userId: entry.userId ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      oldValue: entry.oldValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}
