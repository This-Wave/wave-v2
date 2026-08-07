import "./global.css";
import { useCallback, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/providers/AuthProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import { queryClient } from "./src/lib/queryClient";

SplashScreen.preventAutoHideAsync();

export default function App() {
  // Wave v6 runs on DM Sans alone — the reference's named substitute for
  // Airbnb Cereal. No mono face; order refs and PINs set in DM Sans medium.
  const [fontsLoaded] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <NotificationProvider>
          <NavigationContainer>
            <RootNavigator />
            <StatusBar style="dark" />
          </NavigationContainer>
        </NotificationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
