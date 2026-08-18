import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

let enabled = false;

export function initMobileSentry(): boolean {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: __DEV__ ? 1 : 0.1,
  });
  enabled = true;
  return true;
}

export function wrapWithSentry<T extends ComponentType>(Component: T): T {
  if (!enabled) return Component;
  return Sentry.wrap(Component) as T;
}

export { Sentry };
