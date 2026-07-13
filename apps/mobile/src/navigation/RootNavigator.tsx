import { View } from "react-native";
import { AuthNavigator } from "./AuthNavigator";
import { StudentNavigator } from "./StudentNavigator";
import { RiderNavigator } from "./RiderNavigator";
import { useAuthStore } from "../store/authStore";

export function RootNavigator() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const profile = useAuthStore((s) => s.profile);
  const isHydrating = useAuthStore((s) => s.isHydrating);

  if (isHydrating) {
    return <View className="flex-1 bg-white" />;
  }

  if (!accessToken || !profile) {
    return <AuthNavigator />;
  }

  if (profile.role === "rider") {
    return <RiderNavigator />;
  }

  // Shop/Admin navigators are a follow-up session — see design-import-spec.md.
  return <StudentNavigator />;
}
