import * as Sentry from "@sentry/nextjs";

const dsn = process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    // Explicit, not left to the SDK default (review 07-privacy, checklist item
    // "No PII in analytics"). Wave's users are identified by phone number, so
    // an SDK upgrade that flipped this default would start shipping student
    // phone numbers, IPs and request bodies to a third-party service. Pinning
    // it means that change would be a visible diff rather than a silent one.
    sendDefaultPii: false,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1,
  });
}
