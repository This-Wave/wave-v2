#!/usr/bin/env node
/**
 * Makes the exported web build installable.
 *
 * Runs AFTER `expo export --platform web`, because it edits the `index.html`
 * that export produces. This project does not use Expo Router, so there is no
 * `app/+html.tsx` to own the document head — post-processing the export is the
 * supported seam, and it is the same shape as `build-legal-html.cjs`.
 *
 * Three jobs:
 *
 *  1. Inject the manifest link, theme colour and iOS meta tags into <head>, plus
 *     the service-worker registration. Without the iOS tags specifically, adding
 *     Wave to an iPhone home screen produces a bookmark that opens in Safari
 *     chrome rather than an app window.
 *  2. Write `robots.txt` and `sitemap.xml`, and inject the Open Graph and
 *     Twitter card tags. All three need the deployed origin, which only exists
 *     at build time, so they are generated here rather than committed under
 *     `public/`.
 *  3. Stamp a real version into `sw.js`, replacing the `__SHELL_VERSION__`
 *     placeholder. The cache name is derived from it, so a deploy that did not
 *     change this value would leave every returning user on the previous shell.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const swPath = path.join(dist, "sw.js");

const DESCRIPTION =
  "Campus delivery for Ashesi. Order from off-campus shops and collect at a checkpoint.";

/**
 * The absolute origin this build will be served from.
 *
 * Open Graph, Twitter cards and `sitemap.xml` all reject relative URLs — a
 * relative `og:image` is not a smaller preview, it is no preview at all — so
 * the origin has to be known here.
 *
 * `WAVE_SITE_URL` wins when set. Otherwise Vercel's own
 * `VERCEL_PROJECT_PRODUCTION_URL` (bare host, no scheme) is used, so preview
 * deploys still point their cards at the production domain rather than at a
 * throwaway URL. The literal is the last resort and matches
 * `apps/mobile/.env.example`; set `WAVE_SITE_URL` the day a custom domain
 * lands.
 */
const siteUrl = (
  process.env.WAVE_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://wave-liart-pi.vercel.app")
).replace(/\/+$/, "");

if (!fs.existsSync(indexPath)) {
  console.error(`build-pwa: ${indexPath} not found — run \`expo export --platform web\` first.`);
  process.exit(1);
}

let html = fs.readFileSync(indexPath, "utf8");

if (html.includes('rel="manifest"')) {
  console.log("build-pwa: head already injected, skipping");
} else {
  // Expo's own export already emits `theme-color` (from `expo.web.themeColor`)
  // and a favicon link, so those are added only when absent. Two `theme-color`
  // tags is not an error but the second is dead weight, and a reader cannot
  // tell which one wins.
  const parts = [];
  if (!html.includes('name="theme-color"')) {
    // The canvas, not the ink: it paints the browser surround, and the app's
    // own ground is white. Ink here would put a dark band above a light app.
    parts.push('<meta name="theme-color" content="#ffffff" />');
  }
  if (!html.includes('rel="icon"') && !html.includes('rel="shortcut icon"')) {
    parts.push('<link rel="icon" href="/favicon.png" type="image/png" />');
  }
  // Theme before first paint (PLAN-THEMES.md). The bundle's theme store does
  // the same on load, but a dark-mode user would first see a light page for
  // as long as the bundle takes. Same storage key as src/store/themeStore.ts.
  parts.push(
    "<script>(function(){try{var d=document.documentElement," +
      'm=localStorage.getItem("wave_theme_mode")||"system",' +
      'k=m==="dark"||(m==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);' +
      'if(k)d.setAttribute("data-wave-mode","dark");' +
      'd.style.colorScheme=k?"dark":"light"}catch(e){}})();</script>',
  );
  parts.push(
    '<link rel="manifest" href="/manifest.webmanifest" />',
    `<meta name="description" content="${DESCRIPTION}" />`,
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
    // Wave spreads by students forwarding a link on WhatsApp. Without these,
    // that link previews as a bare URL, which reads as spam. WhatsApp needs
    // og:image to be absolute and reads og:title/og:description only.
    `<link rel="canonical" href="${siteUrl}/" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:site_name" content="Wave" />',
    '<meta property="og:title" content="Wave — campus delivery for Ashesi" />',
    `<meta property="og:description" content="${DESCRIPTION}" />`,
    `<meta property="og:url" content="${siteUrl}/" />`,
    `<meta property="og:image" content="${siteUrl}/og.png" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="The Wave mark beside the words Wave, campus delivery for Ashesi." />',
    '<meta property="og:locale" content="en_GH" />',
    // summary_large_image is what turns the card from a thumbnail into the
    // full-width image; the same og: tags supply its content.
    '<meta name="twitter:card" content="summary_large_image" />',
    // iOS reads none of the manifest. These three tags are the whole of its
    // standalone support: without them "Add to Home Screen" yields a Safari
    // bookmark, not an app window.
    '<meta name="apple-mobile-web-app-capable" content="yes" />',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default" />',
    '<meta name="apple-mobile-web-app-title" content="Wave" />',
    '<meta name="mobile-web-app-capable" content="yes" />',
  );
  const before = html;
  html = html.replace("</head>", `    ${parts.join("\n    ")}\n  </head>`);
  if (html === before) {
    // `String.replace` with a missing marker is a silent no-op, and this script
    // used to report success anyway — so an Expo template change could ship a
    // build with no manifest and no icons while CI stayed green.
    console.error("build-pwa: no </head> in dist/index.html — cannot inject the manifest.");
    process.exit(1);
  }
}

if (!html.includes("serviceWorker")) {
  // Registered on `load` so it never competes with the first paint, and failure
  // is swallowed: the app works without a service worker, and a registration
  // error must not surface to a student as a broken page.
  const script = `
    <script>
      if ('serviceWorker' in navigator) {
        window.addEventListener('load', function () {
          navigator.serviceWorker.register('/sw.js').catch(function () {});
        });
      }
    </script>
`;
  const before = html;
  html = html.replace("</body>", `${script}  </body>`);
  if (html === before) {
    console.error("build-pwa: no </body> in dist/index.html — cannot register the service worker.");
    process.exit(1);
  }
}

fs.writeFileSync(indexPath, html, "utf8");
console.log("build-pwa: injected manifest, icons, iOS meta, OG tags and SW registration into dist/index.html");

// robots.txt and sitemap.xml. Only three URLs are worth listing: everything
// else in this build is behind sign-in and rendered client-side, so a crawler
// following it would index an empty shell. `/_expo/` is disallowed for the same
// reason — those are JS chunks, not pages.
//
// Both files carry absolute URLs, which is why they are written here instead of
// being committed under `public/`.
const SITEMAP_PATHS = ["/", "/legal/terms.html", "/legal/privacy.html"];

fs.writeFileSync(
  path.join(dist, "robots.txt"),
  ["User-agent: *", "Allow: /", "Disallow: /_expo/", "", `Sitemap: ${siteUrl}/sitemap.xml`, ""].join("\n"),
  "utf8",
);

const urls = SITEMAP_PATHS.map((p) => `  <url><loc>${siteUrl}${p}</loc></url>`).join("\n");
fs.writeFileSync(
  path.join(dist, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
  "utf8",
);
console.log(`build-pwa: wrote robots.txt and sitemap.xml for ${siteUrl}`);

if (!fs.existsSync(swPath)) {
  console.error("build-pwa: dist/sw.js missing — is public/sw.js still there?");
  process.exit(1);
}

// Hash the build rather than using a timestamp: a rebuild that changed nothing
// should not invalidate every user's shell cache.
//
// Two things this has to get right. Paths, not bare filenames — two subtrees
// holding the same names must not collide. And the files the service worker
// caches cache-first but which are NOT content-hashed: the manifest and the
// icons. Those are only ever invalidated by the cache name changing, so if they
// were left out of this hash, a deploy that changed only an icon would leave
// every installed user on the old one indefinitely, with no way to clear it
// short of uninstalling.
const staticDir = path.join(dist, "_expo", "static");
if (!fs.existsSync(staticDir)) {
  // Previously skipped silently, which made `version` the hash of the empty
  // string — the same constant on every deploy, so no cache ever invalidated.
  console.error(`build-pwa: ${staticDir} not found — the export looks incomplete.`);
  process.exit(1);
}

const hash = crypto.createHash("sha256");
const walk = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    // Content-hashed by Expo, so the path alone identifies the bytes.
    else hash.update(path.relative(dist, full));
  }
};
walk(staticDir);

// Not content-hashed, so these are hashed by their actual bytes.
for (const rel of ["manifest.webmanifest", "favicon.png"]) {
  const file = path.join(dist, rel);
  if (fs.existsSync(file)) hash.update(fs.readFileSync(file));
}
const iconDir = path.join(dist, "icons");
if (fs.existsSync(iconDir)) {
  for (const name of fs.readdirSync(iconDir).sort()) {
    hash.update(name);
    hash.update(fs.readFileSync(path.join(iconDir, name)));
  }
}

const version = hash.digest("hex").slice(0, 12);

const rawSw = fs.readFileSync(swPath, "utf8");
if (!rawSw.includes("__SHELL_VERSION__")) {
  // Already stamped, so this is a second run over the same dist. Say so rather
  // than printing the freshly computed version, which is NOT what the file
  // holds — that mismatch is actively misleading when checking a build.
  const existing = /const SHELL_VERSION = "([^"]+)"/.exec(rawSw)?.[1] ?? "unknown";
  console.log(`build-pwa: dist/sw.js is already stamped (${existing}); leaving it alone`);
} else {
  fs.writeFileSync(swPath, rawSw.replace("__SHELL_VERSION__", version), "utf8");
  console.log(`build-pwa: stamped shell version ${version} into dist/sw.js`);
}
