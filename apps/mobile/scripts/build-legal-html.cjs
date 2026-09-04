#!/usr/bin/env node
/**
 * Emits the canonical legal pages into `apps/mobile/public/legal/`.
 *
 * Expo copies `public/` verbatim into `dist/` on export, and Vercel serves a
 * real file in preference to the SPA catch-all rewrite in `vercel.json`. So
 * these land at `/legal/terms.html` and `/legal/privacy.html` as ordinary static
 * files — no cold start, no JavaScript, nothing to wake up. That matters because
 * the same URLs go into `EXPO_PUBLIC_TERMS_URL` / `EXPO_PUBLIC_PRIVACY_URL` and,
 * eventually, into an app store listing where a reviewer fetches them.
 *
 * Runs from `build:web`, so a deploy can never ship stale copies: the source of
 * truth is `@wave/shared`'s `legal/content.ts`, and the admin dashboard renders
 * that same data at `/legal/*`.
 *
 * Requires `@wave/shared` to have been built first — `vercel.json` already does
 * that before invoking the Expo export.
 */
const fs = require("node:fs");
const path = require("node:path");

const { LEGAL_DOCS, renderLegalHtml, LEGAL_REVIEWED } = require("@wave/shared");

const outDir = path.join(__dirname, "..", "public", "legal");
fs.mkdirSync(outDir, { recursive: true });

for (const doc of LEGAL_DOCS) {
  const file = path.join(outDir, `${doc.slug}.html`);
  fs.writeFileSync(file, renderLegalHtml(doc), "utf8");
  console.log(`legal: wrote ${path.relative(process.cwd(), file)}`);
}

if (!LEGAL_REVIEWED) {
  console.warn(
    "legal: pages carry the DRAFT banner (LEGAL_REVIEWED is false in @wave/shared). " +
      "Flip it once a qualified adviser has read them.",
  );
}
