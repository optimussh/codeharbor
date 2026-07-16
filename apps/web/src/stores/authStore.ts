import { create } from "zustand";
import { api, type AuthUser } from "../api/client";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  bootstrapped: boolean;
  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: false,
  error: null,
  bootstrapped: false,

  async bootstrap() {
    try {
      const user = await api.me();
      set({ user, bootstrapped: true, error: null });
    } catch {
      set({ user: null, bootstrapped: true });
    }
  },

  async login(username, password) {
    set({ loading: true, error: null });
    try {
      const user = await api.login(username, password);
      set({ user, loading: false });
    } catch (e) {
      set({
        loading: false,
        error: e instanceof Error ? e.message : "Login failed",
      });
      throw e;
    }
  },

  async logout() {
    try {
      await api.logout();
    } finally {
      set({ user: null });
    }
  },
}));
