"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { apiFetch } from "../lib/api";

interface AdminProfile {
  id: string;
  fullName: string;
  phone: string;
  role: string;
}

interface AdminAuthState {
  accessToken: string | null;
  profile: AdminProfile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthState>({
  accessToken: null,
  profile: null,
  isLoading: true,
  signOut: async () => {},
});

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

async function fetchProfile(token: string): Promise<AdminProfile | null> {
  try {
    const { profile } = await apiFetch<{ profile: AdminProfile }>("/profile/me", token);
    return profile;
  } catch {
    return null;
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * The token last applied, together with the promise that applies it.
   *
   * `getSession()` and `onAuthStateChange`'s `INITIAL_SESSION` both deliver the
   * same session on a fresh page load. Applying it twice gave `accessToken` a
   * new identity each time, which re-fired every `useCallback([accessToken])`
   * loader in the app — `/profile/me` and `/admin/stats` were fetched twice on
   * every page, and an admin's unsaved config edits were overwritten.
   *
   * The *promise* is kept, not just the token: a duplicate must wait for the
   * first one's profile fetch rather than return immediately. Returning early
   * lets the caller clear `isLoading` while `profile` is still null, and
   * `(app)/layout.tsx` reads that as "not signed in" and redirects to /login.
   *
   * A ref rather than state, because both handlers are created once by an
   * effect with an empty dep array and would otherwise close over `null`.
   */
  const applied = useRef<{ token: string | null; settled: Promise<void> } | null>(null);

  useEffect(() => {
    function apply(token: string | null): Promise<void> {
      const current = applied.current;
      if (current && current.token === token) return current.settled;

      const settled = (async () => {
        setAccessToken(token);
        setProfile(token ? await fetchProfile(token) : null);
      })();
      applied.current = { token, settled };
      return settled;
    }

    // Kept alongside onAuthStateChange rather than replaced by it: this is the
    // one path guaranteed to settle, and `isLoading` gates the whole admin
    // shell — if it never cleared, every page would render "Loading…" forever.
    supabase.auth.getSession().then(async ({ data }) => {
      await apply(data.session?.access_token ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      await apply(session?.access_token ?? null);
      setIsLoading(false);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    // Clear the ref too, or a later sign-in that happened to mint the same
    // token string would be treated as already applied and ignored.
    applied.current = null;
    setAccessToken(null);
    setProfile(null);
  }

  return (
    <AdminAuthContext.Provider value={{ accessToken, profile, isLoading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
