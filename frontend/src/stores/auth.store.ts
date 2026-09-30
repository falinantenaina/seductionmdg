import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, setTokenProvider, setUnauthorizedHandler } from '@/lib/api';
import type { ApiResponse, LoginResponse, User } from '@/types';

interface AuthState {
  token: string | null;
  user: User | null;
  isHydrated: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isHydrated: false,

      login: async (email, password) => {
        const response = await api.post<ApiResponse<LoginResponse>>('/auth/login', { email, password });
        const { token, user } = response.data.data;
        set({ token, user });
        return user;
      },

      logout: async () => {
        try {
          await api.post('/auth/logout');
        } catch {
          // Le déconnexion locale doit toujours réussir.
        }
        set({ token: null, user: null });
      },

      refreshUser: async () => {
        if (!get().token) return;
        try {
          const response = await api.get<ApiResponse<User>>('/auth/me');
          set({ user: response.data.data });
        } catch {
          set({ token: null, user: null });
        }
      },

      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'seduction.auth',
      partialize: (state) => ({ token: state.token, user: state.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);

setTokenProvider(() => useAuthStore.getState().token);
setUnauthorizedHandler(() => {
  const { token, logout } = useAuthStore.getState();
  if (token) void logout();
});
