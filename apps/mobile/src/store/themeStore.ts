import { Appearance, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

/**
 * Appearance: Light, Dark, or follow the system. PLAN-THEMES.md.
 *
 * Every platform reads its colours from CSS variables (NativeWind v4), and
 * `ThemeRoot` sets the light or dark set from `resolved`. On web this store
 * also stamps `data-wave-mode` on <html>, so the page behind the app matches
 * and the inline script build-pwa.cjs puts in <head> agrees on first paint —
 * keep the storage key in step with it.
 */
export type ThemeMode = "system" | "light" | "dark";
export type Resolved = "light" | "dark";

export const THEME_MODE_KEY = "wave_theme_mode";

const isWeb = Platform.OS === "web" && typeof window !== "undefined";

export function resolveMode(mode: ThemeMode, systemDark: boolean): Resolved {
  return mode === "system" ? (systemDark ? "dark" : "light") : mode;
}

function systemPrefersDark(): boolean {
  if (isWeb) return !!window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return Appearance.getColorScheme() === "dark";
}

function readWebMode(): ThemeMode {
  try {
    const stored = isWeb ? window.localStorage.getItem(THEME_MODE_KEY) : null;
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

function persist(mode: ThemeMode): void {
  if (isWeb) {
    try {
      window.localStorage.setItem(THEME_MODE_KEY, mode);
    } catch {
      // Private windows and blocked storage: the choice lasts for this visit.
    }
    return;
  }
  void AsyncStorage.setItem(THEME_MODE_KEY, mode).catch(() => {});
}

/** Canvas per mode, for the browser's `theme-color` (the phone's status bar on Android web). */
const CANVAS: Record<Resolved, string> = { light: "#ffffff", dark: "#0f1c18" };

function stampWeb(resolved: Resolved): void {
  if (!isWeb) return;
  const root = document.documentElement;
  if (resolved === "dark") root.setAttribute("data-wave-mode", "dark");
  else root.removeAttribute("data-wave-mode");
  root.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", CANVAS[resolved]);
}

const initialMode = readWebMode();

export const useThemeStore = create<{
  mode: ThemeMode;
  resolved: Resolved;
  setMode: (mode: ThemeMode) => void;
}>((set) => ({
  mode: initialMode,
  resolved: resolveMode(initialMode, systemPrefersDark()),
  setMode: (mode) => {
    persist(mode);
    const resolved = resolveMode(mode, systemPrefersDark());
    set({ mode, resolved });
    stampWeb(resolved);
  },
}));

/** The mode in force right now, for code that reads colours outside React (tokens.ts). */
export function currentResolvedMode(): Resolved {
  return useThemeStore.getState().resolved;
}

/** Every platform can switch now; kept so callers read as intent. */
export const canTheme = true;

function followSystem(): void {
  const { mode } = useThemeStore.getState();
  if (mode !== "system") return;
  const resolved = resolveMode(mode, systemPrefersDark());
  useThemeStore.setState({ resolved });
  stampWeb(resolved);
}

// Applied at import, before the first render.
stampWeb(useThemeStore.getState().resolved);
if (isWeb) {
  window.matchMedia?.("(prefers-color-scheme: dark)").addEventListener?.("change", followSystem);
} else {
  Appearance.addChangeListener(followSystem);
  // Native storage is async: a saved choice lands a moment after launch.
  void AsyncStorage.getItem(THEME_MODE_KEY)
    .then((stored) => {
      if (stored === "light" || stored === "dark" || stored === "system") {
        useThemeStore.setState({ mode: stored, resolved: resolveMode(stored, systemPrefersDark()) });
      }
    })
    .catch(() => {});
}
