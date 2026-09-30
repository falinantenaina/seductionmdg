import { beforeEach, describe, expect, it } from 'vitest';
import { useUiStore } from '@/stores/ui.store';

describe('ui.store', () => {
  beforeEach(() => {
    useUiStore.setState({ sidebarCollapsed: false, sidebarHidden: false, mobileNavOpen: false });
  });

  it('démarre avec la sidebar visible et dépliée', () => {
    const state = useUiStore.getState();
    expect(state.sidebarHidden).toBe(false);
    expect(state.sidebarCollapsed).toBe(false);
  });

  it('toggleSidebarHidden masque puis réaffiche la sidebar', () => {
    useUiStore.getState().toggleSidebarHidden();
    expect(useUiStore.getState().sidebarHidden).toBe(true);
    useUiStore.getState().toggleSidebarHidden();
    expect(useUiStore.getState().sidebarHidden).toBe(false);
  });

  it('le repli en rail ne dépend pas du masquage', () => {
    useUiStore.getState().toggleSidebarHidden();
    useUiStore.getState().toggleSidebar();
    expect(useUiStore.getState()).toMatchObject({ sidebarHidden: true, sidebarCollapsed: true });
  });

  it('masque le drawer mobile indépendamment', () => {
    useUiStore.getState().setMobileNavOpen(true);
    useUiStore.getState().toggleSidebarHidden();
    expect(useUiStore.getState()).toMatchObject({ mobileNavOpen: true, sidebarHidden: true });
  });
});
