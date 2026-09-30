import { describe, expect, it } from 'vitest';
import { cn, formatDate, formatMoney, formatNumber, formatShortDate, fullName, numberValue } from './utils';

describe('numberValue', () => {
  it('convertit les chaînes décimales Prisma en nombres', () => {
    expect(numberValue('1234.56')).toBe(1234.56);
    expect(numberValue('-3')).toBe(-3);
    expect(numberValue(42)).toBe(42);
  });

  it('retourne 0 pour les valeurs vides ou invalides', () => {
    expect(numberValue(null)).toBe(0);
    expect(numberValue(undefined)).toBe(0);
    expect(numberValue('')).toBe(0);
    expect(numberValue('pas-un-nombre')).toBe(0);
  });
});

describe('formatMoney', () => {
  it("formate en ariary sans décimale (« Ar »)", () => {
    const grouped = new Intl.NumberFormat('fr-FR').format(1234567);
    expect(formatMoney('1234567')).toBe(`${grouped} Ar`);
    expect(formatMoney('180000')).toBe(`${new Intl.NumberFormat('fr-FR').format(180000)} Ar`);
  });

  it('accepte une devise explicite avec décimales', () => {
    const expected = new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(1234.5);
    expect(formatMoney('1234.5', 'EUR')).toBe(expected);
  });

  it('formate 0 et les valeurs nulles sans erreur', () => {
    const zero = formatMoney(0);
    expect(zero).toBe(`0 Ar`);
    expect(formatMoney(null)).toBe(zero);
    expect(formatMoney('')).toBe(zero);
  });
});

describe('formatNumber', () => {
  it('groupe les milliers', () => {
    expect(formatNumber(1234567)).toBe(new Intl.NumberFormat('fr-FR').format(1234567));
  });
});

describe('formatDate', () => {
  it('affiche un trait quand la date est absente', () => {
    expect(formatDate(null)).toBe('—');
    expect(formatDate(undefined)).toBe('—');
    expect(formatDate('')).toBe('—');
  });

  it('formate une date et un horodatage ISO', () => {
    const iso = '2026-03-05T14:30:00.000Z';
    const expected = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
    expect(formatDate(iso)).toBe(expected);
    expect(formatDate(new Date(iso))).toBe(expected);
  });
});

describe('formatShortDate', () => {
  it('affiche un trait quand la date est absente', () => {
    expect(formatShortDate(null)).toBe('—');
    expect(formatShortDate(undefined)).toBe('—');
  });

  it("interprète « YYYY-MM-DD » en local (pas de décalage d'un jour)", () => {
    const parsed = formatShortDate('2026-03-05');
    expect(parsed).toBe(formatShortDate(new Date(2026, 2, 5)));
    expect(parsed).toBe(
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(2026, 2, 5)),
    );
  });

  it("formate un horodatage ISO complet", () => {
    const iso = '2026-03-05T14:30:00.000Z';
    expect(formatShortDate(iso)).toBe(
      new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short' }).format(new Date(iso)),
    );
  });
});

describe('fullName', () => {
  it("concatène prénom et nom", () => {
    expect(fullName({ firstName: 'Aline', lastName: 'Kabila' })).toBe('Aline Kabila');
  });

  it("affiche un trait sans utilisateur", () => {
    expect(fullName(null)).toBe('—');
    expect(fullName(undefined)).toBe('—');
  });
});

describe('cn', () => {
  it('fusionne les classes en résolvant les conflits Tailwind', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4');
    const hidden = false;
    expect(cn('text-sm', hidden && 'hidden', undefined)).toBe('text-sm');
  });
});
