import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./fixtures/loadEnv";

loadEnv();

/**
 * The narrated "how Wave is used" recording. One order is followed end to end
 * across the four roles, so the chapters must run in file order: one worker,
 * no parallelism, and the mobile and admin chapters split by tag into two
 * projects that each keep their own viewport.
 *
 * Run `packages/db/scripts/seed-demo.ts` first — the chapters claim and deliver
 * the demo order it resets — then `node e2e/tools/walkthrough-video.mjs`.
 */
export default defineConfig({
  testDir: "./specs",
  testMatch: /walkthrough\.spec\.ts/,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 600_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["json", { outputFile: "results/walkthrough.json" }]],
  outputDir: "results/walkthrough-artifacts",
  use: {
    trace: "off",
    screenshot: "off",
    actionTimeout: 25_000,
    launchOptions: { slowMo: 450 },
  },
  projects: [
    {
      name: "phone",
      grep: /@mobile/,
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:8082",
        viewport: { width: 390, height: 844 },
        video: { mode: "on", size: { width: 390, height: 844 } },
      },
    },
    {
      name: "desktop",
      grep: /@admin/,
      dependencies: ["phone"],
      use: {
        ...devices["Desktop Chrome"],
        baseURL: "http://127.0.0.1:3100",
        viewport: { width: 1280, height: 800 },
        video: { mode: "on", size: { width: 1280, height: 800 } },
      },
    },
  ],
});
