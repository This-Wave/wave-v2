import type { ReactNode } from "react";
import { Platform, View } from "react-native";
import { vars } from "nativewind";
import { themes, triplet, varName } from "@wave/shared/palettes.cjs";
import { useThemeStore } from "../store/themeStore";

const toVars = (set: Record<string, string>) =>
  vars(Object.fromEntries(Object.entries(set).map(([role, hex]) => [varName(role), triplet(hex)])));

const VARS = { light: toVars(themes.light), dark: toVars(themes.dark) } as const;

/**
 * Sets the colour variables for the whole app from the chosen mode.
 *
 * On native the subtree is re-keyed on a mode change: raw `colors` (SVG
 * strokes, inline styles) are read during render from the current mode
 * (tokens.ts), so everything must render again to pick them up. Web needs no
 * remount — its raw colours are `var()` strings already (tokens.web.ts).
 */
export function ThemeRoot({ children }: { children: ReactNode }) {
  const resolved = useThemeStore((s) => s.resolved);
  return (
    <View key={Platform.OS === "web" ? undefined : resolved} style={[{ flex: 1 }, VARS[resolved]]}>
      {children}
    </View>
  );
}
