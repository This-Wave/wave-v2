import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./fixtures/loadEnv";

loadEnv();

/**
 * Full-stack manual-QA harness (not the CI suite — that is apps/admin/e2e).
 *
 * This drives the real admin dashboard and the real mobile app running on
 * Expo web, against the real API on :4010, the real Neon database and the
 * real Supabase project. Everything is recorded, because the point of the
 * run is for a human to watch it afterwards.
 */
export default defineConfig({
  testDir: "./specs",
  // Sequential: these share one database and one set of dev accounts, so
  // parallel runs would fight over the same orders.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The walkthrough run is deliberately slow and narrated, so a journey that
  // takes ~15s at test pace takes minutes. WALKTHROUGH=1 buys it the room.
  timeout: process.env.WALKTHROUGH ? 900_000 : 180_000,
  expect: { timeout: 20_000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "results/results.json" }],
    ["html", { outputFolder: "results/html", open: "never" }],
  ],
  outputDir: "results/artifacts",
  use: {
    // Recording size is set per project — a phone screen forced into a
    // 1280x800 frame records as a small image in a grey field.
    video: "on",
    trace: "on",
    screenshot: "on",
    actionTimeout: 25_000,
    // Slow the machine down to something a person could follow on the video.
    // 320ms is watchable-if-you-know-the-app; WALKTHROUGH pace is for someone
    // seeing it for the first time, who needs to read each screen before it
    // changes.
    launchOptions: { slowMo: process.env.WALKTHROUGH ? 850 : 320 },
  },
  projects: [
    {
      name: "admin",
      testMatch: /admin\.spec\.ts/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 1280, height: 800 },
        video: { mode: "on", size: { width: 1280, height: 800 } },
      },
    },
    {
      name: "mobile",
      testMatch: /(student|rider|shop)(-onboarding)?\.spec\.ts/,
      // A phone-shaped viewport, because every one of these screens is a
      // phone screen and the web build is only a proxy for the device.
      use: {
        ...devices["iPhone 13"],
        baseURL: "http://127.0.0.1:8082",
        // The iPhone preset selects WebKit. Keep the phone viewport but run
        // Chromium, which is the engine this Expo web build was verified on.
        browserName: "chromium",
        defaultBrowserType: "chromium",
        isMobile: false,
        hasTouch: true,
        video: { mode: "on", size: { width: 390, height: 664 } },
      },
    },
  ],
});
