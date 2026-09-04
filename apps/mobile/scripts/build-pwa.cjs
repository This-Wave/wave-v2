#!/usr/bin/env node
/**
 * Makes the exported web build installable.
 *
 * Runs AFTER `expo export --platform web`, because it edits the `index.html`
 * that export produces. This project does not use Expo Router, so there is no
 * `app/+html.tsx` to own the document head — post-processing the export is the
 * supported seam, and it is the same shape as `build-legal-html.cjs`.
 *
 * Two jobs:
 *
 *  1. Inject the manifest link, theme colour and iOS meta tags into <head>, plus
 *     the service-worker registration. Without the iOS tags specifically, adding
 *     Wave to an iPhone home screen produces a bookmark that opens in Safari
 *     chrome rather than an app window.
 *  2. Stamp a real version into `sw.js`, replacing the `__SHELL_VERSION__`
 *     placeholder. The cache name is derived from it, so a deploy that did not
 *     change this value would leave every returning user on the previous shell.
 */
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const dist = path.join(__dirname, "..", "dist");
const indexPath = path.join(dist, "index.html");
const swPath = path.join(dist, "sw.js");

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
    // own ground is #f7f7f7. Ink here would put a dark band above a light app.
    parts.push('<meta name="theme-color" content="#f7f7f7" />');
  }
  if (!html.includes('rel="icon"') && !html.includes('rel="shortcut icon"')) {
    parts.push('<link rel="icon" href="/favicon.png" type="image/png" />');
  }
  parts.push(
    '<link rel="manifest" href="/manifest.webmanifest" />',
    '<meta name="description" content="Campus delivery for Ashesi. Order from off-campus shops and collect at a checkpoint." />',
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />',
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
console.log("build-pwa: injected manifest, icons, iOS meta and SW registration into dist/index.html");

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
