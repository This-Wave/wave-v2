import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";

// @supabase/supabase-js v2.110+ initialises Realtime on every client, which
// needs a WebSocket. Node 22 ships one globally; Node 20 (Render's default
// until .nvmrc is bumped) does not — polyfill so the API boots either way.
if (typeof globalThis.WebSocket === "undefined") {
  globalThis.WebSocket = WebSocket as unknown as typeof globalThis.WebSocket;
}

/** Server-side Supabase client — auth + storage only, no persisted session. */
export function createServerSupabaseClient(supabaseUrl: string, serviceRoleKey: string) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
