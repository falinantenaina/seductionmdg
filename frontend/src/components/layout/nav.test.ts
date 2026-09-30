import { describe, expect, it } from 'vitest';
import { ALL_ROLES, NAV_ITEMS, hasAccess, visibleNavItems } from './nav';

describe('visibleNavItems', () => {
  it('ne montre rien sans rôle', () => {
    expect(visibleNavItems(undefined)).toEqual([]);
  });

  it('ADMIN voit toutes les entrées du menu', () => {
    expect(visibleNavItems('ADMIN')).toHaveLength(NAV_ITEMS.length);
  });

  it('LIVREUR ne voit ni utilisateurs, ni statistiques, ni factures', () => {
    const paths = visibleNavItems('LIVREUR').map((item) => item.path);
    expect(paths).toContain('/dashboard');
    expect(paths).toContain('/deliveries');
    expect(paths).toContain('/settings');
    expect(paths).not.toContain('/users');
    expect(paths).not.toContain('/statistics');
    expect(paths).not.toContain('/invoices');
    expect(paths).not.toContain('/stocks/movements');
  });

  it("MAGASINIER accède au magasin mais pas à la facturation", () => {
    const paths = visibleNavItems('MAGASINIER').map((item) => item.path);
    expect(paths).toEqual(
      expect.arrayContaining(['/warehouse', '/categories', '/stocks', '/stocks/movements', '/orders']),
    );
    expect(paths).not.toContain('/invoices');
    expect(paths).not.toContain('/customers');
  });

  it('chaque rôle voit au moins le tableau de bord et les paramètres', () => {
    for (const role of ALL_ROLES) {
      const paths = visibleNavItems(role).map((item) => item.path);
      expect(paths).toContain('/dashboard');
      expect(paths).toContain('/settings');
    }
  });
});

describe('hasAccess', () => {
  it("refuse sans rôle", () => {
    expect(hasAccess('/dashboard', undefined)).toBe(false);
  });

  it("autorise le rôle correspondant à l'entrée", () => {
    expect(hasAccess('/warehouse', 'MAGASINIER')).toBe(true);
    expect(hasAccess('/warehouse', 'COMMERCIAL')).toBe(false);
    expect(hasAccess('/statistics', 'ADMIN')).toBe(true);
    expect(hasAccess('/statistics', 'DISPATCHER')).toBe(false);
  });

  it('applique le chemin le plus long : /stocks/movements prime sur /stocks', () => {
    expect(hasAccess('/stocks/movements', 'MAGASINIER')).toBe(true);
    expect(hasAccess('/stocks/movements', 'COMMERCIAL')).toBe(false);
    expect(hasAccess('/stocks', 'COMMERCIAL')).toBe(true);
  });

  it('suit les sous-chemins (détail, création)', () => {
    expect(hasAccess('/orders/123', 'FACTURIER')).toBe(true);
    expect(hasAccess('/orders/new', 'LIVREUR')).toBe(false);
  });

  it("autorise les chemins hors menu (profil, 404) par défaut", () => {
    expect(hasAccess('/profile', 'LIVREUR')).toBe(true);
    expect(hasAccess('/route-inconnue', 'COMMERCIAL')).toBe(true);
  });
});
