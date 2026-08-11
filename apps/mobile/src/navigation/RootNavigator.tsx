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

  if (isHydrating) {
    return <SplashScreen />;
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
