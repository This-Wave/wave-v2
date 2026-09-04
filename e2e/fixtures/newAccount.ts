import type { Page } from "@playwright/test";

const SUPABASE_URL = process.env.E2E_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.E2E_SUPABASE_ANON_KEY!;
const SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY!;

const STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

/**
 * A throwaway account that has never completed onboarding.
 *
 * The existing `session.ts` signs in as one of the four *seeded* accounts,
 * which already have profiles — so every existing spec starts inside the app
 * and none of them can record onboarding, because onboarding is by definition
 * the part that only happens once per account.
 *
 * This creates a genuinely new Supabase auth user instead, with no `Profile`
 * row behind it. The app therefore boots exactly as it does for a real new
 * signup: a valid session, `profile === null`, and `AuthNavigator` resuming at
 * the role picker.
 *
 * What this does NOT simulate is the SMS one-time code. Getting a session by
 * the password grant rather than by `verifyOtp` is the same shortcut
 * `session.ts` has always taken, and for the same reason — there is no inbox to
 * read. Deliberately no OTP bypass was added to the app for this: a code path
 * that mints a session without the code is worth far more to an attacker than
 * it is to a test, and `__DEV__` is not a strong enough guard to stake account
 * takeover on.
 */
export interface NewAccount {
  id: string;
  phone: string;
  password: string;
  session: Record<string, unknown>;
}

const created: string[] = [];

/** Ghana mobile numbers, in a range no real person is reachable on. */
function throwawayPhone(): string {
  const suffix = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  return `+23320${suffix}`;
}

export async function createNewAccount(): Promise<NewAccount> {
  if (!SERVICE_ROLE_KEY) {
    throw new Error(
      "E2E_SUPABASE_SERVICE_ROLE_KEY missing — loadEnv() reads it from packages/api/.env",
    );
  }

  const phone = throwawayPhone();
  const password = `Wave${Math.random().toString(36).slice(2, 10)}!A1`;

  const createResponse = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    // `phone_confirm` stands in for the code having been entered correctly.
    body: JSON.stringify({ phone, password, phone_confirm: true }),
  });
  const createdUser = (await createResponse.json()) as { id?: string };
  if (!createResponse.ok || !createdUser.id) {
    throw new Error(
      `could not create throwaway account: ${createResponse.status} ${JSON.stringify(createdUser)}`,
    );
  }
  created.push(createdUser.id);

  const tokenResponse = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });
  const body = (await tokenResponse.json()) as Record<string, unknown>;
  if (!tokenResponse.ok || !body.access_token) {
    throw new Error(`could not sign in as throwaway: ${tokenResponse.status} ${JSON.stringify(body)}`);
  }

  return {
    id: createdUser.id,
    phone,
    password,
    session: { ...body, expires_at: Math.floor(Date.now() / 1000) + Number(body.expires_in ?? 3600) },
  };
}

/** Boot the app already holding this account's session, before any script runs. */
export async function useAccount(page: Page, account: NewAccount): Promise<void> {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key as string, value as string),
    [STORAGE_KEY, JSON.stringify(account.session)] as const,
  );
}

/**
 * Delete every throwaway auth user this run created.
 *
 * These are real rows in the real Supabase project — the same project the pilot
 * will use — so leaving them behind would pad the user count and, worse, leave
 * accounts with working passwords on live infrastructure.
 */
export async function deleteCreatedAccounts(): Promise<void> {
  for (const id of created.splice(0)) {
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    }).catch(() => {
      // Reported by the caller; a failed cleanup must not fail the journey.
    });
  }
}
