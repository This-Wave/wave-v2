import { useEffect, type ReactNode } from "react";
import { supabase } from "../lib/supabase";
import { fetchMyProfile } from "../lib/profile";
import { registerPushToken } from "../lib/notifications";
import { useAuthStore } from "../store/authStore";

async function syncProfile() {
  try {
    const profile = await fetchMyProfile();
    useAuthStore.getState().setProfile(profile);

    // Only once a Profile row exists — `POST /notifications/token` writes to
    // it, so registering earlier would 401. Re-run on every session because
    // Expo can rotate a device's token without telling the client.
    if (profile) {
      await registerPushToken();
    }
  } catch {
    // 401 here means the Supabase user has no Profile row yet — expected for
    // a brand-new phone-OTP signup that hasn't finished ProfileSetupScreen.
    useAuthStore.getState().setProfile(null);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const { setSession, clearSession, setHydrating } = useAuthStore.getState();

    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        setSession(data.session.access_token, data.session.refresh_token);
        await syncProfile();
      }
      setHydrating(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session) {
        setSession(session.access_token, session.refresh_token);
        await syncProfile();
      } else {
        clearSession();
      }
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
