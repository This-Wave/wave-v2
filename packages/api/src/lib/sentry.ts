import * as Sentry from "@sentry/node";
import type { FastifyInstance } from "fastify";
import type { Env } from "../config/env";

let enabled = false;

export function initSentry(env: Pick<Env, "SENTRY_DSN" | "NODE_ENV">): void {
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Explicit, not left to the SDK default (review 07-privacy, checklist item
    // "No PII in analytics"). Wave's users are identified by phone number, so
    // an SDK upgrade that flipped this default would start shipping student
    // phone numbers, IPs and request bodies to a third-party service. Pinning
    // it means that change would be a visible diff rather than a silent one.
    sendDefaultPii: false,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 1,
  });
  enabled = true;
}

export function setupSentryFastify(app: FastifyInstance): void {
  if (!enabled) return;
  Sentry.setupFastifyErrorHandler(app);
}

export function capturePaymentError(
  err: unknown,
  meta: { phase: string; orderId?: string; reference?: string },
): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("wave.domain", "payment");
    scope.setContext("payment", meta);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}

export function capturePaymentIssue(
  message: string,
  meta: { phase: string; orderId?: string; reference?: string; expectedGhs?: number },
): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("wave.domain", "payment");
    scope.setContext("payment", meta);
    Sentry.captureMessage(message, "error");
  });
}

export function captureSmsError(err: unknown, meta: { phase: string }): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    scope.setTag("wave.domain", "sms");
    scope.setContext("sms", meta);
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)));
  });
}
