import { createClient } from "@supabase/supabase-js";

// Auth only — the admin dashboard talks to the Fastify API for all data,
// never queries Neon/Prisma directly from the browser.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
