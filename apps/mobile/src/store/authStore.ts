import { create } from "zustand";
import type { Profile } from "../types";

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  profile: Profile | null;
  isHydrating: boolean;
  setSession: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
  setProfile: (profile: Profile | null) => void;
  setHydrating: (isHydrating: boolean) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  refreshToken: null,
  profile: null,
  isHydrating: true,
  setSession: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  clearSession: () => set({ accessToken: null, refreshToken: null, profile: null }),
  setProfile: (profile) => set({ profile }),
  setHydrating: (isHydrating) => set({ isHydrating }),
}));
