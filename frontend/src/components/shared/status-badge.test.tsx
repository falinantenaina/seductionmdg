import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DeliveryStatusBadge,
  InvoiceStatusBadge,
  MovementTypeBadge,
  OrderStatusBadge,
} from './status-badge';

describe('OrderStatusBadge', () => {
  it('affiche le libellé français de chaque statut de commande', () => {
    const cases: Array<[Parameters<typeof OrderStatusBadge>[0]['status'], string]> = [
      ['BROUILLON', 'Brouillon'],
      ['COMMANDE', 'Commande'],
      ['EN_FACTURATION', 'En facturation'],
      ['FACTUREE', 'Facturée'],
      ['A_PREPARER', 'À préparer'],
      ['SORTIE_MAGASIN', 'Sortie magasin'],
      ['EN_LIVRAISON', 'En livraison'],
      ['LIVREE', 'Livrée'],
      ['ANNULEE', 'Annulée'],
    ];
    for (const [status, label] of cases) {
      const { container, unmount } = render(<OrderStatusBadge status={status} />);
      expect(container.textContent).toContain(label);
      unmount();
    }
  });
});

describe('InvoiceStatusBadge', () => {
  it("affiche les statuts d'une facture", () => {
    const { container } = render(<InvoiceStatusBadge status="PAYEE" />);
    expect(container.textContent).toContain('Payée');
    expect(screen.getByText('Payée')).toBeTruthy();
  });

  it("affiche une facture annulée", () => {
    const { container } = render(<InvoiceStatusBadge status="ANNULEE" />);
    expect(container.textContent).toContain('Annulée');
  });
});

describe('DeliveryStatusBadge', () => {
  it("affiche les statuts d'une livraison", () => {
    const first = render(<DeliveryStatusBadge status="A_LIVRER" />);
    expect(first.container.textContent).toContain('À livrer');
    first.unmount();

    const second = render(<DeliveryStatusBadge status="ECHEC" />);
    expect(second.container.textContent).toContain('Échec');
  });
});

describe('MovementTypeBadge', () => {
  it('affiche le type de mouvement de stock', () => {
    const first = render(<MovementTypeBadge type="ENTREE" />);
    expect(first.container.textContent).toContain('Entrée');
    first.unmount();

    const second = render(<MovementTypeBadge type="SORTIE" />);
    expect(second.container.textContent).toContain('Sortie');
  });
});
