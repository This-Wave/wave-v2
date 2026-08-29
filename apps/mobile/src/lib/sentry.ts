import * as Sentry from "@sentry/react-native";
import type { ComponentType } from "react";

let enabled = false;

export function initMobileSentry(): boolean {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: __DEV__ ? "development" : "production",
    // Explicit, not left to the SDK default (review 07-privacy, checklist item
    // "No PII in analytics"). Wave's users are identified by phone number, so
    // an SDK upgrade that flipped this default would start shipping student
    // phone numbers, IPs and request bodies to a third-party service. Pinning
    // it means that change would be a visible diff rather than a silent one.
    sendDefaultPii: false,
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
