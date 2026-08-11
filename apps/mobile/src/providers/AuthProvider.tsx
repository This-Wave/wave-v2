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
    //
    // Deliberately NOT awaited. This runs inside the startup path that clears
    // `isHydrating`, and push registration can block indefinitely: it asks for
    // OS notification permission, and a permission prompt waits on the user,
    // not on a timeout. Awaiting it meant a student who never answered that
    // prompt sat on the splash screen forever, unable to reach the app at all.
    // Observed on web, where the browser permission dialog does exactly this.
    //
    // Push is an accelerator — every state it announces is also reachable by
    // opening the app — so it must never gate sign-in. `registerPushToken`
    // already reports failure by returning rather than throwing.
    if (profile) {
      void registerPushToken();
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
