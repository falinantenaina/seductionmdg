import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { DataTable } from '@/components/shared/data-table';
import { TableCell, TableRow } from '@/components/ui/table';

function buildRow(name: string, city: string, showActions: boolean) {
  return (
    <TableRow key={name}>
      <TableCell>{name}</TableCell>
      <TableCell className="whitespace-nowrap">{city}</TableCell>
      <TableCell>
        <span>Actif</span>
      </TableCell>
      {showActions && (
        <TableCell>
          <button type="button">{`Modifier ${name}`}</button>
        </TableCell>
      )}
    </TableRow>
  );
}

describe('DataTable', () => {
  it('rend le tableau en desktop et une carte par ligne pour le mobile', () => {
    const { container } = render(
      <DataTable headers={['Client', 'Ville', 'Statut', 'Actions']}>
        {buildRow('Alice', 'Kinshasa', true)}
      </DataTable>,
    );

    expect(screen.getByRole('table')).toBeTruthy();

    const cards = container.querySelectorAll('ul > li');
    expect(cards).toHaveLength(1);
    const card = within(cards[0] as HTMLElement);

    expect(card.getByText('Alice')).toBeTruthy();
    expect(card.getByText('Ville')).toBeTruthy();
    expect(card.getByText('Kinshasa')).toBeTruthy();
    expect(card.getByText('Actif')).toBeTruthy();

    expect(card.getByRole('button', { name: 'Modifier Alice' })).toBeTruthy();
    expect(card.queryByText('Actions')).toBeNull();
  });

  it('colonne sans libellé traitée comme actions en haut de carte', () => {
    const { container } = render(
      <DataTable headers={['Client', 'Ville', 'Statut', '']}>
        {buildRow('Bob', 'Antananarivo', true)}
      </DataTable>,
    );

    const card = container.querySelector('ul > li') as HTMLElement;
    expect(card.querySelector('button')?.textContent).toBe('Modifier Bob');
    expect(card.querySelector('dl')?.querySelector('button')).toBeNull();
    expect(within(card).queryByText('Ville')).toBeTruthy();
  });

  it('affiche les squelettes de chargement dans les deux modes', () => {
    const { container } = render(
      <DataTable headers={['Client', 'Ville']} loading>
        {null}
      </DataTable>,
    );

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('ul > li')).toHaveLength(0);
  });

  it('affiche l’état vide en desktop et en mobile', () => {
    render(
      <DataTable headers={['Client']} isEmpty emptyTitle="Aucun client" emptyDescription="Ajoutez vos clients.">
        {null}
      </DataTable>,
    );

    expect(screen.getAllByText('Aucun client')).toHaveLength(2);
    expect(screen.getAllByText('Ajoutez vos clients.')).toHaveLength(2);
  });

  it('affiche l’erreur avec une action de retry unique', () => {
    render(
      <DataTable headers={['Client']} error="Réseau indisponible" onRetry={() => undefined}>
        {null}
      </DataTable>,
    );

    expect(screen.getByText('Impossible de charger les données')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Réessayer' })).toHaveLength(1);
  });
});
