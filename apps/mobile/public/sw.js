/*
 * Wave service worker.
 *
 * Its whole job is to make the app OPEN when the network is poor. It is
 * deliberately not a data cache, and the distinction matters more here than in
 * most apps: Wave shows order status, delivery PINs and money. A stale answer
 * to "has my order been paid for" is worse than no answer, because the student
 * acts on it.
 *
 * So the rule is: cache the shell, never cache the data.
 *
 *   same-origin, content-hashed (/_expo/static, /assets)  cache-first, immutable
 *   same-origin icons + manifest                     cache-first
 *   same-origin navigations                          network-first, shell fallback
 *   everything else (the API is cross-origin)        not intercepted at all
 *
 * `SHELL_VERSION` is rewritten at build time by scripts/build-pwa.cjs so that a
 * deploy produces a genuinely new cache name. Do not bump it by hand.
 */
const SHELL_VERSION = "__SHELL_VERSION__";
const CACHE = `wave-shell-${SHELL_VERSION}`;

/**
 * The minimum needed to render something. The JS bundle is deliberately absent:
 * its filename is content-hashed and changes every build, so it is picked up by
 * the runtime cache-first rule below instead of being named here.
 */
const SHELL = ["/", "/index.html", "/manifest.webmanifest", "/icons/icon-192.png", "/favicon.png"];

const OFFLINE_HTML = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Wave is offline</title><style>
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
background:#f7f7f7;color:#083400;font:16px/1.6 "DM Sans",system-ui,sans-serif;padding:24px}
main{max-width:34ch;text-align:center}h1{font-size:20px;margin:0 0 8px}
p{margin:0;color:#6a6a6a}</style></head><body><main>
<h1>You're offline</h1><p>Wave needs a connection to show your orders. This page will work
again as soon as you're back on data or Wi-Fi.</p></main></body></html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // `reload` bypasses the HTTP cache, so a fresh install never precaches a
      // stale copy of index.html that the browser happened to be holding.
      cache.addAll(SHELL.map((url) => new Request(url, { cache: "reload" }))).catch(() => {
        // A precache miss must not abort the install — the runtime rules below
        // still work, and a worker that fails to install leaves no worker at all.
      }),
    ),
  );
  // Deliberately NOT skipWaiting(). A new worker takes over on the next launch,
  // once no page is running. Activating underneath a live page would let
  // `activate` delete the very cache that page is still pulling chunks from.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names.filter((n) => n.startsWith("wave-shell-") && n !== CACHE).map((n) => caches.delete(n)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Content-hashed build output. Safe to keep forever; the name changes instead.
 *
 * `/assets/` matters as much as `/_expo/static/`: it is where Expo emits the DM
 * Sans faces, and `App.tsx` renders nothing until they resolve. Leaving it out
 * meant the shell loaded offline and then painted a white screen, which is worse
 * than no offline support at all because it looks like the app is broken.
 */
function isImmutable(url) {
  return url.pathname.startsWith("/_expo/static/") || url.pathname.startsWith("/assets/");
}

function isIcon(url) {
  return url.pathname.startsWith("/icons/") || url.pathname === "/favicon.png" ||
    url.pathname === "/manifest.webmanifest";
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin is left entirely alone, which is what keeps the API out of the
  // cache without needing to know the API's hostname here.
  if (url.origin !== self.location.origin) return;

  // Belt and braces for a same-origin API path, if one is ever proxied.
  if (url.pathname.startsWith("/v1/")) return;

  if (isImmutable(url) || isIcon(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok) {
            const copy = fresh.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy));
          }
          return fresh;
        } catch {
          // Offline. The SPA shell can render its own "no connection" states,
          // which is a better landing place than a browser error page.
          const shell = (await caches.match("/index.html")) || (await caches.match("/"));
          return (
            shell ||
            new Response(OFFLINE_HTML, {
              status: 503,
              headers: { "Content-Type": "text/html; charset=utf-8" },
            })
          );
        }
      })(),
    );
  }
});
