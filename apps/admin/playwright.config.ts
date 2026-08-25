import { defineConfig, devices } from "@playwright/test";

/**
 * Admin end-to-end tests (review 02-qa-engineer, H2 — the admin app had none).
 *
 * These deliberately cover only what is provable WITHOUT live credentials: the
 * auth gate, the login form's own validation, and that no signed-out route ever
 * renders admin data. Logging in for real needs a Supabase user and a running
 * API, so those journeys (verify a rider, resolve a suggestion, refund an
 * order) stay in the device/QA matrix rather than pretending to be automated
 * here — a suite that silently skips its own subject is worse than no suite.
 *
 * `webServer` builds and starts the app, so `npm run test:e2e` is self-contained.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "list" : "html",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // `npm run start` already applies `-p ${PORT:-3000}`, so the port goes
    // through the environment rather than a second, conflicting flag.
    command: "npm run build && npm run start",
    url: `http://127.0.0.1:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      PORT: String(PORT),
      // The app only needs these to construct its Supabase client at build
      // time; no request is made against them in these tests.
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://stub.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "stub-anon-key",
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:4000",
    },
  },
});
