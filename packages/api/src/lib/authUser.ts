import type { FastifyInstance } from "fastify";
import type { User } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "./supabaseServer";

/**
 * Resolves the Supabase auth user behind a bearer token, with no requirement
 * that a Wave `Profile` row exists yet.
 *
 * Deliberately separate from the `authenticate` decorator, which loads the
 * profile and 401s without one. The two places that need this — completing a
 * profile after a phone-OTP signup, and password registration — are precisely
 * the requests made *before* the profile exists, so `authenticate` cannot
 * serve them.
 *
 * Returns `null` on any failure; callers decide the status code, since
 * "no token" and "bad token" mean the same thing to a client but the copy
 * differs by route.
 */
export async function resolveSupabaseUser(
  fastify: FastifyInstance,
  authHeader: string | undefined,
): Promise<User | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const supabase = createServerSupabaseClient(
    fastify.config.SUPABASE_URL,
    fastify.config.SUPABASE_SERVICE_ROLE_KEY,
  );
  const token = authHeader.slice("Bearer ".length);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * True when the phone on a verified Supabase session is the same number the
 * request claims to be registering.
 *
 * Compared on digits only. Supabase stores `user.phone` without the leading
 * `+` (`233241234567`) while Wave passes E.164 (`+233241234567`), so a literal
 * `===` here would reject every legitimate caller — and the tempting "fix" of
 * dropping the check entirely is the hole this exists to close.
 */
export function phoneMatchesSession(sessionPhone: string | undefined, claimed: string): boolean {
  if (!sessionPhone) return false;
  const digits = (v: string) => v.replace(/\D/g, "");
  const a = digits(sessionPhone);
  const b = digits(claimed);
  return a.length > 0 && a === b;
}
