import type { Page } from "@playwright/test";
import { ACCOUNTS, type RoleKey } from "./accounts";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY!;

/** `sb-<project-ref>-auth-token` is supabase-js v2's default storage key. */
const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

const cache = new Map<RoleKey, Record<string, unknown>>();

/**
 * Mint a real Supabase session with the password grant.
 *
 * The mobile app signs in by SMS one-time code and nothing else, so a browser
 * test can never complete its login screen — there is no inbox to read. What
 * we can do is get a genuine session by another door and hand it to the app in
 * the same place the app would have stored it. Everything downstream — the
 * JWT, the API's `getUser` check, the role gate — is then exactly what a real
 * signed-in user gets. Only the login screen itself goes untested here.
 */
export async function mintSession(role: RoleKey): Promise<Record<string, unknown>> {
  const cached = cache.get(role);
  if (cached) return cached;

  const { phone, password } = ACCOUNTS[role];
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok || !body.access_token) {
    throw new Error(`could not sign in as ${role}: ${response.status} ${JSON.stringify(body)}`);
  }

  const session = {
    ...body,
    expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600),
  };
  cache.set(role, session);
  return session;
}

/**
 * Seed the session before any app script runs, so the app boots already
 * signed in rather than flashing the welcome screen and navigating away.
 */
export async function signIn(page: Page, role: RoleKey): Promise<void> {
  const session = await mintSession(role);
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );
}

/**
 * Sign in with a session the client believes is nearly expired, so supabase-js
 * refreshes it a short way into the test rather than in an hour.
 *
 * The refresh token is genuine, so a real new JWT comes back and a real
 * `TOKEN_REFRESHED` event fires — which is the exact trigger that used to wipe
 * an admin's unsaved config edits. supabase-js ticks every 30s and refreshes
 * when expiry is within ~90s, so ~125s out puts the refresh after the first
 * couple of ticks, i.e. after the test has typed something.
 */
export async function signInExpiringSoon(page: Page, role: RoleKey, secondsToExpiry = 125): Promise<void> {
  const session = { ...(await mintSession(role)) };
  session.expires_in = secondsToExpiry;
  session.expires_at = Math.floor(Date.now() / 1000) + secondsToExpiry;
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, JSON.stringify(session)] as const,
  );
}

/** A bearer token for talking to the API directly from a test. */
export async function tokenFor(role: RoleKey): Promise<string> {
  return (await mintSession(role)).access_token as string;
}

export const API_URL = process.env.E2E_API_URL ?? "http://127.0.0.1:4010/v1";
