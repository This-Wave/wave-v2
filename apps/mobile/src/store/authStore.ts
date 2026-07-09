import { create } from "zustand";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  setSession: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  setSession: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  clearSession: () => set({ accessToken: null, refreshToken: null }),
}));
