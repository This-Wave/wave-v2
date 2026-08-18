import "./global.css";
import { useCallback, useEffect } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { QueryClientProvider } from "@tanstack/react-query";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts } from "expo-font";
import {
  DMSans_400Regular,
  DMSans_500Medium,
  DMSans_600SemiBold,
  DMSans_700Bold,
} from "@expo-google-fonts/dm-sans";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { navigationRef } from "./src/lib/navigationRef";
import { PaymentReturnListener } from "./src/components/PaymentReturnListener";
import { AuthProvider } from "./src/providers/AuthProvider";
import { NotificationProvider } from "./src/providers/NotificationProvider";
import { queryClient } from "./src/lib/queryClient";
import { clearSkipTransition, markHistoryNavigation } from "./src/lib/navigationMotion";
import { ToastHost } from "./src/components/v6";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { initMobileSentry, wrapWithSentry } from "./src/lib/sentry";

initMobileSentry();

SplashScreen.preventAutoHideAsync();

function App() {
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

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    window.addEventListener("popstate", markHistoryNavigation);
    return () => window.removeEventListener("popstate", markHistoryNavigation);
  }, []);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AuthProvider>
            <NotificationProvider>
              <NavigationContainer
                ref={navigationRef}
                onStateChange={() => {
                  requestAnimationFrame(() => clearSkipTransition());
                }}
              >
                <RootNavigator />
                <PaymentReturnListener />
                <ToastHost />
                <StatusBar style="dark" />
              </NavigationContainer>
            </NotificationProvider>
          </AuthProvider>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default wrapWithSentry(App);
