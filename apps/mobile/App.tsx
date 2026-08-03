import "./global.css";
import { useCallback, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  Geist_400Regular,
  Geist_500Medium,
  Geist_600SemiBold,
  Geist_700Bold,
} from "@expo-google-fonts/geist";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { AuthProvider } from "./src/providers/AuthProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import { queryClient } from "./src/lib/queryClient";

SplashScreen.preventAutoHideAsync();

export default function App() {
  // Wave v5 runs on Geist alone — no separate mono face (see tailwind.config.js).
  const [fontsLoaded] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
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
