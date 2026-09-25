// Native: raw colours for places className cannot reach (SVG strokes, inline
// styles), read from the mode in force when a component renders. ThemeRoot
// remounts the tree on a mode change, so every read is fresh. Web resolves
// `./tokens.web.ts` (CSS-variable strings) instead.
import { themes } from "@wave/shared/palettes.cjs";
import { colors as light } from "./tokens.base";
import { currentResolvedMode } from "../store/themeStore";

export * from "./tokens.base";

type Colors = { [K in keyof typeof light]: string };

export const colors = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.keys(light).map((role) => [
      role,
      {
        enumerable: true,
        get: () =>
          role === "white" ? light.white : themes[currentResolvedMode()][role as keyof typeof themes.light],
      },
    ]),
  ),
) as Colors;
