import type { Prisma } from '@prisma/client';

type Db = Prisma.TransactionClient;

/**
 * Incrémente atomiquement un compteur nommé et renvoie la nouvelle valeur.
 * Utilisé pour les numéros séquentiels (commande, facture, livraison).
 */
export async function nextSequence(tx: Db, key: string): Promise<number> {
  const rows = await tx.$queryRaw<{ value: number }[]>`
    INSERT INTO "Sequence" (key, value, "updatedAt")
    VALUES (${key}, 1, NOW())
    ON CONFLICT (key)
    DO UPDATE SET value = "Sequence".value + 1, "updatedAt" = NOW()
    RETURNING value
  `;
  return Number(rows[0]?.value ?? 1);
}

export async function nextNumber(
  tx: Db,
  key: string,
  prefix: string,
  padLength = 4,
): Promise<string> {
  const value = await nextSequence(tx, key);
  return `${prefix}-${String(value).padStart(padLength, '0')}`;
}
