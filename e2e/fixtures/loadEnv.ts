import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * The repo has no dotenv dependency and each app loads its own .env by a
 * different mechanism (node --env-file, Next, Expo). The harness needs the
 * Supabase pair, which only packages/api/.env carries, so read it directly.
 * Real environment variables win, so CI can override without editing a file.
 */
export function loadEnv(): void {
  const file = resolve(__dirname, "../../packages/api/.env");
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[2].trim().replace(/^["'](.*)["']$/, "$1");
    if (match[1] === "SUPABASE_URL") process.env.E2E_SUPABASE_URL ??= value;
    if (match[1] === "SUPABASE_ANON_KEY") process.env.E2E_SUPABASE_ANON_KEY ??= value;
    // Needed only by the onboarding specs, which create and then delete real
    // throwaway auth users — the one thing the anon key cannot do.
    if (match[1] === "SUPABASE_SERVICE_ROLE_KEY") process.env.E2E_SUPABASE_SERVICE_ROLE_KEY ??= value;
  }
}
