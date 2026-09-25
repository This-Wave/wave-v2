import { Platform } from "react-native";
import { create } from "zustand";

/**
 * Appearance: Light, Dark, or follow the system. PLAN-THEMES.md.
 *
 * Web only for now. The web build reads every colour from CSS variables, and
 * this store switches them by stamping `data-wave-mode` on <html>. Native
 * builds compile colours in at build time (NativeWind v2) and stay light — the
 * Appearance row is not shown there.
 *
 * The same key is read by the inline script build-pwa.cjs puts in <head>, so
 * a production page paints in the right theme before the bundle arrives. Keep
 * the two in step.
 */
export type ThemeMode = "system" | "light" | "dark";

export const THEME_MODE_KEY = "wave_theme_mode";

const isWeb = Platform.OS === "web" && typeof window !== "undefined";

function read(key: string): string | null {
  try {
    return isWeb ? window.localStorage.getItem(key) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    if (isWeb) window.localStorage.setItem(key, value);
  } catch {
    // Private windows and blocked storage: the choice lasts for this visit.
  }
}

export function resolveMode(mode: ThemeMode, systemDark: boolean): "light" | "dark" {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

function systemPrefersDark(): boolean {
  return isWeb && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
}

/** Canvas per mode, for the browser's `theme-color` (the phone's status bar on Android). */
const CANVAS = { light: "#ffffff", dark: "#0f1c18" } as const;

function apply(mode: ThemeMode): void {
  if (!isWeb) return;
  const resolved = resolveMode(mode, systemPrefersDark());
  const root = document.documentElement;
  // Light is the variables' default, so it is the absence of the attribute.
  if (resolved === "dark") root.setAttribute("data-wave-mode", "dark");
  else root.removeAttribute("data-wave-mode");
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CANVAS[resolved]);
}

function initialMode(): ThemeMode {
  const stored = read(THEME_MODE_KEY);
  return stored === "light" || stored === "dark" || stored === "system" ? stored : "system";
}

export const useThemeStore = create<{
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}>((set) => ({
  mode: initialMode(),
  setMode: (mode) => {
    write(THEME_MODE_KEY, mode);
    set({ mode });
    apply(mode);
  },
}));

/** Whether this build can change appearance at runtime. */
export const canTheme = isWeb;

// Applied at import, before the first render, and again whenever the OS flips
// between light and dark while "System" is chosen.
if (isWeb) {
  apply(useThemeStore.getState().mode);
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    const { mode } = useThemeStore.getState();
    if (mode === "system") apply(mode);
  });
}
