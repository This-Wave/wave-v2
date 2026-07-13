"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setAccessToken(data.session.access_token);
        setProfile(await fetchProfile(data.session.access_token));
      }
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        setAccessToken(session.access_token);
        setProfile(await fetchProfile(session.access_token));
      } else {
        setAccessToken(null);
        setProfile(null);
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    setAccessToken(null);
    setProfile(null);
  }

  return (
    <AdminAuthContext.Provider value={{ accessToken, profile, isLoading, signOut }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
