import { AuthNavigator } from "./AuthNavigator";
import { StudentNavigator } from "./StudentNavigator";
import { RiderNavigator } from "./RiderNavigator";
import { ShopNavigator } from "./ShopNavigator";
import { SplashScreen } from "../screens/auth/SplashScreen";
import { useAuthStore } from "../store/authStore";

export function RootNavigator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const profile = useAuthStore((s) => s.profile);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  if (isHydrating) {
    return <SplashScreen />;
  }

  if (!accessToken || !profile) {
    return <AuthNavigator />;
  }

  if (profile.role === "rider") {
    return <RiderNavigator />;
  }

  if (profile.role === "shop_owner") {
    return <ShopNavigator />;
  }

  // Admin navigator is a follow-up session — see design-import-spec.md.
  return <StudentNavigator />;
}
