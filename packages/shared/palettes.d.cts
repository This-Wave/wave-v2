/** Types for palettes.cjs — see that file and PLAN-THEMES.md. */
export type Role =
  | "canvas" | "surface" | "surfaceMuted" | "ink" | "inkSoft" | "muted" | "icon" | "subtle" | "hairline"
  | "lime" | "limePressed" | "limeFaint" | "onAccent" | "onInk" | "onDanger" | "panel" | "onPanel"
  | "danger" | "dangerBg" | "warning" | "warningBg" | "link";
export type Theme = Record<Role, string>;
export declare const themes: Record<"light" | "dark", Theme>;
export declare function triplet(hex: string): string;
export declare function varName(role: string): string;
export declare function themeCss(): Record<string, Record<string, string>>;
export declare function twColor(role: string): string;
