import { AuthNavigator } from "./AuthNavigator";
import { StudentNavigator } from "./StudentNavigator";
import { RiderNavigator } from "./RiderNavigator";
import { ShopNavigator } from "./ShopNavigator";
import { SplashScreen } from "../screens/auth/SplashScreen";
import { RootFadeShell } from "../components/RootFadeShell";
import { useAuthStore } from "../store/authStore";

export function RootNavigator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const profile = useAuthStore((s) => s.profile);
  const isHydrating = useAuthStore((s) => s.isHydrating);
  const guestUniversityId = useAuthStore((s) => s.guestUniversityId);
  const signingUpFromGuest = useAuthStore((s) => s.signingUpFromGuest);

  if (isHydrating) {
    return <SplashScreen />;
  }

  // A guest browses the student app with no account. Only while they are not
  // in the middle of creating one: then the auth flow takes over, and the
  // basket waits in `resume` until the new profile exists.
  if (!profile && guestUniversityId && !signingUpFromGuest && !accessToken) {
    return (
      <RootFadeShell routeKey="guest">
        <StudentNavigator />
      </RootFadeShell>
    );
  }

  if (!accessToken || !profile) {
    return (
      <RootFadeShell routeKey="auth">
        <AuthNavigator />
      </RootFadeShell>
    );
  }

  if (profile.role === "rider") {
    return (
      <RootFadeShell routeKey={`rider-${profile.id}`}>
        <RiderNavigator />
      </RootFadeShell>
    );
  }

  if (profile.role === "shop_owner") {
    return (
      <RootFadeShell routeKey={`shop-${profile.id}`}>
        <ShopNavigator />
      </RootFadeShell>
    );
  }

  return (
    <RootFadeShell routeKey={`student-${profile.id}`}>
      <StudentNavigator />
    </RootFadeShell>
  );
}
