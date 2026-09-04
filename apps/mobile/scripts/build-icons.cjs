#!/usr/bin/env node
/**
 * Rasterises every icon in the project from the four SVGs in `assets/source/`.
 *
 * Deliberately NOT part of `build:web`. The PNGs it writes are committed, so a
 * deploy never needs this to run — which matters because it shells out to
 * `rsvg-convert` (librsvg), a tool no CI runner or Vercel builder is guaranteed
 * to have. Run it by hand when the artwork changes:
 *
 *     brew install librsvg          # once
 *     npm run build:icons --workspace @wave/mobile
 *
 * Replacing the mark is therefore a one-file edit plus one command, rather than
 * hunting down eight sizes across two directories.
 */
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const src = (name) => path.join(root, "assets", "source", name);

/**
 * Every raster the project references, and where the reference lives. If you
 * add an entry here, add the thing that reads it in the same commit — an icon
 * nothing points at is worse than no icon, because it looks handled.
 */
const TARGETS = [
  // app.json → expo.icon / expo.splash.image / expo.android.adaptiveIcon
  { from: "mark.svg", to: "assets/icon.png", size: 1024 },
  { from: "splash.svg", to: "assets/splash.png", size: 1024 },
  { from: "adaptive-foreground.svg", to: "assets/adaptive-icon.png", size: 1024 },
  // public/ is copied verbatim into dist/ by `expo export`, so these land at
  // the web root where the manifest and the <head> tags expect them.
  { from: "mark.svg", to: "public/icons/icon-192.png", size: 192 },
  { from: "mark.svg", to: "public/icons/icon-512.png", size: 512 },
  { from: "mark-maskable.svg", to: "public/icons/icon-maskable-512.png", size: 512 },
  // iOS ignores the manifest's icons entirely and reads this one tag instead.
  { from: "mark.svg", to: "public/icons/apple-touch-icon.png", size: 180 },
  { from: "mark.svg", to: "public/favicon.png", size: 48 },
];

function have(cmd) {
  try {
    execFileSync("which", [cmd], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

if (!have("rsvg-convert")) {
  console.error(
    "build-icons: `rsvg-convert` not found.\n" +
      "  macOS:  brew install librsvg\n" +
      "  Debian: apt-get install librsvg2-bin\n" +
      "The committed PNGs are still valid — this script is only needed to regenerate them.",
  );
  process.exit(1);
}

for (const t of TARGETS) {
  const out = path.join(root, t.to);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  execFileSync("rsvg-convert", [
    "--width", String(t.size),
    "--height", String(t.size),
    "--output", out,
    src(t.from),
  ]);
  const kb = (fs.statSync(out).size / 1024).toFixed(1);
  console.log(`icons: ${t.to} (${t.size}px, ${kb}kB)`);
}

console.log(`icons: wrote ${TARGETS.length} files from assets/source/`);
