import type { Page } from "@playwright/test";

/**
 * On-screen narration for the walkthrough recording.
 *
 * The recording exists for a person to watch, and a silent screen capture of an
 * app they did not build is close to unreadable — you can see a form being
 * filled without ever learning what was being proved. `step()` puts a full
 * chapter card on screen, holds it long enough to read, then clears it and lets
 * the action happen underneath.
 *
 * A full card rather than a caption bar on purpose: every screen in this app
 * puts its primary button at the bottom and its title at the top, so a
 * persistent overlay would cover exactly the parts the video needs to show.
 *
 * The card lives in a **closed** shadow root. Playwright pierces open shadow
 * roots, so an open one would put this narration text into the same text index
 * the specs search — and a card reading "Choosing a role" would happily satisfy
 * a later `getByText(/role/i)`. Closed is the difference between narration and a
 * false pass.
 */
const HOLD_MS = Number(process.env.NARRATION_MS ?? 2200);

/** Set NARRATION=0 to run these specs as plain tests, with no cards. */
const ENABLED = process.env.NARRATION !== "0";

export async function step(
  page: Page,
  title: string,
  detail?: string,
  holdMs = HOLD_MS,
): Promise<void> {
  if (!ENABLED) return;

  await page.evaluate(
    ({ title, detail }) => {
      document.getElementById("wave-narration")?.remove();

      const host = document.createElement("div");
      host.id = "wave-narration";
      host.style.cssText =
        "position:fixed;inset:0;z-index:2147483647;pointer-events:none;";
      document.body.appendChild(host);

      // Closed: Playwright cannot pierce it, so this text never collides with
      // the spec's own selectors.
      const root = host.attachShadow({ mode: "closed" });
      root.innerHTML = `
        <style>
          .card {
            position: fixed; inset: 0;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            gap: 12px; padding: 32px;
            background: #083400;
            font-family: "DM Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            text-align: center;
            animation: in 260ms ease-out;
          }
          @keyframes in { from { opacity: 0 } to { opacity: 1 } }
          .rule { width: 28px; height: 3px; border-radius: 999px; background: #87ea5c; }
          h1 { margin: 0; color: #ffffff; font-size: 24px; line-height: 1.25; font-weight: 700; letter-spacing: -0.01em; }
          p  { margin: 0; color: #cfe8c4; font-size: 15px; line-height: 1.5; max-width: 300px; }
        </style>
        <div class="card">
          <div class="rule"></div>
          <h1></h1>
          ${detail ? "<p></p>" : ""}
        </div>`;
      (root.querySelector("h1") as HTMLElement).textContent = title;
      if (detail) (root.querySelector("p") as HTMLElement).textContent = detail;
    },
    { title, detail },
  );

  await page.waitForTimeout(holdMs);
  await page.evaluate(() => document.getElementById("wave-narration")?.remove());
  // A beat between the card clearing and the action starting, so the viewer
  // sees the screen the card was describing before anything moves on it.
  await page.waitForTimeout(500);
}

/**
 * A card that stays up while something happens off-screen.
 *
 * Some of the most important moments in these journeys are not on the phone at
 * all — an admin approving a rider, a shop being made visible to students. Those
 * would otherwise be an unexplained pause on a static screen.
 */
export async function aside<T>(page: Page, title: string, detail: string, work: () => Promise<T>): Promise<T> {
  if (!ENABLED) return work();

  await step(page, title, detail, 1800);
  return work();
}
