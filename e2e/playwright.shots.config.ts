import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./fixtures/loadEnv";

loadEnv();

/**
 * Screenshot-capture config for the UX/accessibility pass.
 *
 * Separate from `playwright.config.ts` on purpose: that harness exists to fail
 * a run on console errors and >=400 responses, and it records video of every
 * journey. This one only needs still frames, so video, trace and slowMo are all
 * off — a capture run is minutes rather than tens of minutes.
 *
 * `SHOT_DIR` names the output folder, which is how the same spec produces the
 * "before" and "after" sets from two different commits.
 */
export default defineConfig({
  testDir: "./specs",
  testMatch: /(screenshots|a11y)\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 300_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "results/shots-artifacts",
  use: {
    video: "off",
    trace: "off",
    screenshot: "off",
    actionTimeout: 20_000,
  },
  projects: [
    {
      name: "admin",
      testMatch: /(screenshots|a11y)\.spec\.ts/,
      grep: /@admin/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: /(screenshots|a11y)\.spec\.ts/,
      grep: /@mobile/,
      use: {
        // Phone-shaped, because every one of these is a phone screen. Chromium
        // rather than the preset's WebKit — the engine this Expo web build was
        // verified on.
        ...devices["iPhone 13"],
        baseURL: "http://127.0.0.1:8082",
        browserName: "chromium",
        defaultBrowserType: "chromium",
        isMobile: false,
        hasTouch: true,
        viewport: { width: 390, height: 844 },
      },
    },
  ],
});
