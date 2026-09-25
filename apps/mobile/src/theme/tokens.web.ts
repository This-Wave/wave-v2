/**
 * Web: every colour as a CSS variable, so a theme change (data-wave-mode /
 * data-wave-palette on <html>) repaints SVG strokes and inline styles too, not
 * just className. The variables default to v6 light — PLAN-THEMES.md §3.
 *
 * Same names as the native `colors`; a local export shadows the star export.
 */
import { colors as hex } from "./tokens.base";

export * from "./tokens.base";

const cssVar = (role: string) => `rgb(var(--wave-${role.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}))`;

type Colors = { [K in keyof typeof hex]: string };

export const colors = Object.fromEntries(
  Object.keys(hex).map((role) => [role, role === "white" ? hex.white : cssVar(role)]),
) as Colors;
