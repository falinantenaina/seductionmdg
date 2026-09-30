import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('rend un bouton avec le spinner en chargement', () => {
    render(<Button loading>Envoyer</Button>);
    expect(screen.getByText('Envoyer')).toBeTruthy();
    expect(document.querySelector('svg.lucide-loader-2, svg.animate-spin')).toBeTruthy();
    expect((screen.getByText('Envoyer').closest('button') as HTMLButtonElement).disabled).toBe(true);
  });

  it('rend un lien en mode asChild sans planter (Slot : enfant élément unique)', () => {
    render(
      <Button asChild variant="outline">
        <a href="/statistics">Statistiques</a>
      </Button>,
    );
    const link = screen.getByText('Statistiques');
    expect(link.getAttribute('href')).toBe('/statistics');
    expect(link.tagName).toBe('A');
  });

  it('le mode asChild transmet className', () => {
    render(
      <Button asChild>
        <a href="/stocks">Stocks</a>
      </Button>,
    );
    const link = screen.getByText('Stocks');
    expect(link.className).toContain('inline-flex');
  });
});
