import type { Page } from "@playwright/test";
import { themes } from "@wave/shared/palettes.cjs";

/**
 * Renders a page in `THEME` (`light` or `dark`) — PLAN-THEMES.md.
 *
 * Seeds the storage key both apps read, and also stamps the mode and its
 * canvas colour on <html> before any page script runs. That second half is
 * what a production build's inline <head> script does; the dev server serves a
 * bare page, so without it every dark recording opens on a white flash that no
 * real user of the built app would see.
 */
export async function applyTheme(page: Page, theme: string | undefined): Promise<void> {
  if (!theme) return;
  if (theme !== "light" && theme !== "dark") throw new Error(`unknown THEME ${theme} (light | dark)`);
  const canvas = themes[theme].canvas;
  await page.addInitScript(
    ([mode, canvas]) => {
      window.localStorage.setItem("wave_theme_mode", mode);
      const root = document.documentElement;
      if (mode === "dark") root.setAttribute("data-wave-mode", "dark");
      root.style.colorScheme = mode;
      root.style.backgroundColor = canvas;
    },
    [theme, canvas] as const,
  );
}
