import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every spec runs on top of this: it records the console errors and the
 * >=400 responses each journey produced, and fails the test on any of them.
 *
 * A screen that renders while quietly 500ing in the background looks fine on
 * the video and is exactly the class of bug this run is meant to catch, so
 * the network log is an assertion, not a diagnostic.
 */
export type PageProblems = { consoleErrors: string[]; failedRequests: string[] };

export const problems = new WeakMap<Page, PageProblems>();

/** Requests that are expected to fail and must not fail the run. */
const IGNORED = [
  /favicon/i,
  // Expo dev server chatter, not the app.
  /symbolicate|\/logs|hot-update|__expo/i,
];

export function watch(page: Page): PageProblems {
  const record: PageProblems = { consoleErrors: [], failedRequests: [] };
  problems.set(page, record);
  page.on("console", (message) => {
    if (message.type() === "error") record.consoleErrors.push(message.text().slice(0, 300));
  });
  page.on("pageerror", (error) => record.consoleErrors.push(`uncaught: ${String(error).slice(0, 300)}`));
  page.on("response", (response) => {
    const url = response.url();
    if (response.status() < 400 || IGNORED.some((r) => r.test(url))) return;
    record.failedRequests.push(`${response.status()} ${response.request().method()} ${url.slice(0, 160)}`);
  });
  return record;
}

export const test = base.extend<{ watched: PageProblems }>({
  watched: async ({ page }, use) => {
    const record = watch(page);
    await use(record);
    // Reported as a soft check so the journey's own assertions surface first.
    expect.soft(record.consoleErrors, "console errors during the journey").toEqual([]);
    expect.soft(record.failedRequests, "failed HTTP responses during the journey").toEqual([]);
  },
});

/**
 * React Navigation keeps previous screens mounted and merely hides them, so a
 * plain getByText().first() happily resolves to a stale, invisible copy on the
 * screen you just navigated away from. Every assertion about "what is on
 * screen now" has to filter to what is actually visible.
 */
export function onScreen(page: Page, text: string | RegExp) {
  return page.getByText(text).locator("visible=true").first();
}

/** Expo's bundle takes a few seconds; wait for real content, not a timer. */
export async function bootMobile(page: Page, anchor: string | RegExp): Promise<void> {
  await page.goto("/", { waitUntil: "load" });
  await expect(onScreen(page, anchor)).toBeVisible({ timeout: 90_000 });
}

export { expect };
