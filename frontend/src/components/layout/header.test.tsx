import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Header } from '@/components/layout/header';
import { useUiStore } from '@/stores/ui.store';

vi.mock('@/components/shared/notifications-bell', () => ({
  NotificationsBell: () => null,
}));

describe('Header', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false, sidebarHidden: false, mobileNavOpen: false });
  });

  it('masque puis réaffiche la sidebar via le bouton du bandeau', () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <Header />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const toggle = screen.getByRole('button', { name: 'Masquer le menu' });
    fireEvent.click(toggle);
    expect(useUiStore.getState().sidebarHidden).toBe(true);

    const restore = screen.getByRole('button', { name: 'Afficher le menu' });
    fireEvent.click(restore);
    expect(useUiStore.getState().sidebarHidden).toBe(false);
  });
});
