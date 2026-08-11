import { createClient } from "@supabase/supabase-js";

// Auth only — the admin dashboard talks to the Fastify API for all data,
// never queries Neon/Prisma directly from the browser.
//
// Placeholders keep `next build` from crashing when NEXT_PUBLIC_* are unset
// during a misconfigured deploy; runtime auth calls still fail loudly enough
// to notice in the login screen.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
