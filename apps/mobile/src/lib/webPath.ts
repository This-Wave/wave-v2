import { Platform } from "react-native";

/**
 * Whether a pathname is one the web app does not serve.
 *
 * Pure, and exported separately from the check below, because the environment
 * guard is untestable here — `Platform.OS` is not `"web"` under vitest, so a
 * test of the combined function returns `false` for every input and passes for
 * entirely the wrong reason. Splitting it means the decision is tested and only
 * the one-line guard is not.
 *
 * `/` is the only path served. Deep links are not URL-based (there is no
 * `linking` config on the NavigationContainer), and the Paystack return comes
 * back to the origin with query parameters rather than a path — see
 * `consumePaymentReturn`. `pathname` excludes the query string, so the return
 * flow never looks unknown.
 */
export function isUnknownPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, "");
  return path !== "" && path !== "/index.html";
}

/**
 * Whether the browser is on a path the web app does not serve.
 *
 * `apps/mobile/vercel.json` rewrites every path to `index.html` — that is what
 * makes a single-page app work — but it also meant a typo'd or stale URL loaded
 * the whole app and landed silently on Home. Nothing was broken and nothing
 * said so, which is worse than an error page. Static files such as
 * `/legal/terms.html` are served by Vercel before the rewrite and never reach
 * this code.
 */
export function isUnknownWebPath(): boolean {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return isUnknownPath(window.location.pathname);
}
