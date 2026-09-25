/**
 * Admin appearance: Light, Dark or System. Same storage key and <html>
 * attribute as the mobile app (apps/mobile/src/store/themeStore.ts), so a staff
 * member's choice follows them between the two on one device. PLAN-THEMES.md.
 */
export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODE_KEY = "wave_theme_mode";

export function readMode(): ThemeMode {
  try {
    const m = window.localStorage.getItem(THEME_MODE_KEY);
    return m === "light" || m === "dark" ? m : "system";
  } catch {
    return "system";
  }
}

export function applyMode(mode: ThemeMode): void {
  const dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const root = document.documentElement;
  if (dark) root.setAttribute("data-wave-mode", "dark");
  else root.removeAttribute("data-wave-mode");
  root.style.colorScheme = dark ? "dark" : "light";
}

export function saveMode(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(THEME_MODE_KEY, mode);
  } catch {
    // Blocked storage: the choice lasts for this page.
  }
  applyMode(mode);
}

/**
 * Runs in <head> before hydration, so the first paint is already in the right
 * theme. Kept as a string because it ships inline; it must not import anything.
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var d=document.documentElement,m=localStorage.getItem("${THEME_MODE_KEY}")||"system",k=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);if(k)d.setAttribute("data-wave-mode","dark");d.style.colorScheme=k?"dark":"light"}catch(e){}})();`;
