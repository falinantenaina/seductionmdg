import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UiState {
  sidebarCollapsed: boolean;
  sidebarHidden: boolean;
  mobileNavOpen: boolean;
  toggleSidebar: () => void;
  toggleSidebarHidden: () => void;
  setMobileNavOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarHidden: false,
      mobileNavOpen: false,
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      toggleSidebarHidden: () => set((state) => ({ sidebarHidden: !state.sidebarHidden })),
      setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
    }),
    {
      name: 'seduction.ui',
      partialize: (state) => ({ sidebarCollapsed: state.sidebarCollapsed, sidebarHidden: state.sidebarHidden }),
    },
  ),
);
