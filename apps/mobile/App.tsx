import "./global.css";
import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { NotFoundScreen } from "./src/screens/NotFoundScreen";
import { isUnknownWebPath } from "./src/lib/webPath";
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
import { clearSkipTransition, initReducedMotionPreference, markHistoryNavigation } from "./src/lib/navigationMotion";
import { ToastHost } from "./src/components/v6";
import { InstallHint } from "./src/components/InstallHint";
import { captureInstallPrompt } from "./src/lib/installPrompt";
import { ErrorBoundary } from "./src/components/ErrorBoundary";
import { initMobileSentry, wrapWithSentry } from "./src/lib/sentry";

initMobileSentry();

SplashScreen.preventAutoHideAsync();

function App() {
  // Wave v6 runs on DM Sans alone — the reference's named substitute for
  // Airbnb Cereal. No mono face; order refs and PINs set in DM Sans medium.
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    DMSans_700Bold,
  });

  // `fontError` counts as ready. A font that cannot load — offline, or a CDN
  // hiccup — used to leave `fontsLoaded` false forever and render `null`, which
  // is a white screen with no way out. DM Sans falling back to the system sans
  // is a visible downgrade; a blank app is not recoverable by the student.
  const fontsSettled = fontsLoaded || !!fontError;

  const onLayoutRootView = useCallback(async () => {
    if (fontsSettled) {
      await SplashScreen.hideAsync();
    }
  }, [fontsSettled]);

  useEffect(() => {
    onLayoutRootView();
  }, [onLayoutRootView]);

  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    window.addEventListener("popstate", markHistoryNavigation);
    return () => window.removeEventListener("popstate", markHistoryNavigation);
  }, []);

  // Primes the cached "reduce motion" preference that `stackScreenOptions`
  // reads when React Navigation resolves screen options (review 10-a11y, M2).
  useEffect(() => initReducedMotionPreference(), []);

  // Must be armed before the browser fires `beforeinstallprompt`, which happens
  // shortly after load and exactly once. Missing it means the install button in
  // `InstallHint` has nothing to open, so this sits at the top of the tree
  // rather than inside the component that eventually uses it.
  useEffect(() => captureInstallPrompt(), []);

  // Read once. The path cannot change without a reload — nothing here calls
  // pushState except the payment return, which only strips query params.
  const [unknownPath] = useState(() => isUnknownWebPath());

  if (!fontsSettled) {
    return null;
  }

  // Before anything else: `vercel.json` rewrites every path to index.html, so a
  // typo'd URL used to load the whole app and land silently on Home. Checked
  // here rather than inside the navigator because there are no URL routes to
  // miss — the app ignores the path entirely — and because a 404 should not
  // require a session to read.
  if (unknownPath) {
    return (
      <SafeAreaProvider>
        <NotFoundScreen />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
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
                <InstallHint />
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
