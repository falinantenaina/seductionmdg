import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Les montants Prisma (Decimal) arrivent en chaîne côté API. */
export function numberValue(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Devise de l'application : l'ariary (Ar) n'a pas de décimale. */
export const CURRENCY = 'MGA';

export function formatMoney(value: string | number | null | undefined, currency = CURRENCY): string {
  const amount = numberValue(value);
  const digits = currency === 'MGA' ? 0 : 2;
  const formatted = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
  // Intl affiche « MGA » : on préfère le symbole usuel « Ar ».
  if (currency === 'MGA') return `${formatted} Ar`;
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const date = typeof value === 'string' ? new Date(value) : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export function formatShortDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  // Une date « YYYY-MM-DD » est interprétée en local (sinon décalage d'un jour).
  const date =
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T00:00:00`)
      : typeof value === 'string'
        ? new Date(value)
        : value;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(date);
}

export function fullName(user: { firstName: string; lastName: string } | null | undefined): string {
  return user ? `${user.firstName} ${user.lastName}` : '—';
}
