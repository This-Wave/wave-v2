import { create } from "zustand";
import type { Profile } from "../types";

/**
 * Where a guest was when they were asked to create an account, so the app can
 * put them straight back there once they have one. Loosely typed on purpose:
 * the store is imported by the navigators, so it cannot import their param
 * lists without a cycle.
 */
export interface ResumeTarget {
  route: string;
  params?: Record<string, unknown>;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  profile: Profile | null;
  isHydrating: boolean;
  /**
   * Browsing without an account (since 2026-11-04). A guest can look at shops
   * and menus, build a basket, pick a checkpoint and see the total. Placing the
   * order is the one thing that needs an account. The campus is all a guest
   * session holds, because everything a student browses is per campus.
   */
  guestUniversityId: string | null;
  /** Set while a guest is in the sign-up flow they started at checkout. */
  signingUpFromGuest: boolean;
  /** Where to land after that sign-up. Consumed once by the student navigator. */
  resume: ResumeTarget | null;
  setSession: (accessToken: string, refreshToken: string) => void;
  clearSession: () => void;
  setProfile: (profile: Profile | null) => void;
  setHydrating: (isHydrating: boolean) => void;
  startGuest: (universityId: string) => void;
  /** A guest pressed Pay: remember where, and open sign-up. */
  beginSignupFromGuest: (resume: ResumeTarget) => void;
  /** Back out of that sign-up and keep browsing as a guest. */
  cancelSignupFromGuest: () => void;
  takeResume: () => ResumeTarget | null;
  endGuest: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  accessToken: null,
  refreshToken: null,
  profile: null,
  isHydrating: true,
  guestUniversityId: null,
  signingUpFromGuest: false,
  resume: null,
  setSession: (accessToken, refreshToken) => set({ accessToken, refreshToken }),
  clearSession: () =>
    set({
      accessToken: null,
      refreshToken: null,
      profile: null,
      guestUniversityId: null,
      signingUpFromGuest: false,
      resume: null,
    }),
  // A real profile ends the guest session: from here the account's own campus
  // is the one that counts, and the sign-up detour is over.
  setProfile: (profile) =>
    set(profile ? { profile, guestUniversityId: null, signingUpFromGuest: false } : { profile }),
  setHydrating: (isHydrating) => set({ isHydrating }),
  startGuest: (universityId) => set({ guestUniversityId: universityId, signingUpFromGuest: false }),
  beginSignupFromGuest: (resume) => set({ resume, signingUpFromGuest: true }),
  cancelSignupFromGuest: () => set({ signingUpFromGuest: false, resume: null }),
  takeResume: () => {
    const resume = get().resume;
    if (resume) set({ resume: null });
    return resume;
  },
  endGuest: () => set({ guestUniversityId: null, signingUpFromGuest: false, resume: null }),
}));

/** True while browsing without an account. */
export function useIsGuest(): boolean {
  return useAuthStore((s) => !s.profile && !!s.guestUniversityId);
}

/** The campus everything is browsed for: the account's, or the guest's choice. */
export function useViewerUniversityId(): string | undefined {
  return useAuthStore((s) => s.profile?.universityId ?? s.guestUniversityId ?? undefined);
}

/** Non-hook form, for query functions and event handlers. */
export function isGuestNow(): boolean {
  const s = useAuthStore.getState();
  return !s.profile && !!s.guestUniversityId;
}
