import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BreakdownBars, TrendChart } from './charts';

describe('TrendChart', () => {
  const points = [
    { label: '01/03', value: 10 },
    { label: '02/03', value: 0 },
    { label: '03/03', value: 25 },
    { label: '04/03', value: 5 },
  ];

  it('dessine une barre par point de données', () => {
    const { container } = render(<TrendChart points={points} />);
    expect(container.querySelectorAll('.group')).toHaveLength(points.length);
  });

  it('affiche les libellés extrêmes et médian (sans doublon)', () => {
    render(<TrendChart points={points} />);
    expect(screen.getByText('01/03')).toBeTruthy();
    expect(screen.getByText('04/03')).toBeTruthy();
    // indice 4/2 = 2 → « 03/03 »
    expect(screen.getByText('03/03')).toBeTruthy();
    expect(screen.queryByText('02/03')).toBeNull();
  });

  it('accepte un formateur de valeurs personnalisé', () => {
    render(<TrendChart points={points} formatValue={(value) => `${value} Ar`} />);
    expect(screen.getAllByText('10 Ar')).toHaveLength(1);
    expect(screen.getAllByText('25 Ar')).toHaveLength(1);
  });

  it("gère la liste vide sans planter", () => {
    const { container } = render(<TrendChart points={[]} />);
    expect(container.querySelectorAll('.group')).toHaveLength(0);
  });
});

describe('BreakdownBars', () => {
  it("affiche un message par défaut quand il n'y a pas de données", () => {
    render(<BreakdownBars items={[]} />);
    expect(screen.getByText('Aucune donnée sur la période.')).toBeTruthy();
  });

  it('liste chaque entrée avec sa valeur et son indice', () => {
    render(
      <BreakdownBars
        items={[
          { label: 'Robe soiree', value: 42, hint: '5 ventes' },
          { label: 'Chemise', value: 7 },
        ]}
      />,
    );
    expect(screen.getByText('Robe soiree')).toBeTruthy();
    expect(screen.getByText('42')).toBeTruthy();
    expect(screen.getByText('5 ventes')).toBeTruthy();
    expect(screen.getByText('Chemise')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('utilise le formateur fourni', () => {
    render(
      <BreakdownBars
        items={[{ label: 'CA', value: 1500 }]}
        formatValue={(value) => `$${value}`}
      />,
    );
    expect(screen.getByText('$1500')).toBeTruthy();
  });
});
