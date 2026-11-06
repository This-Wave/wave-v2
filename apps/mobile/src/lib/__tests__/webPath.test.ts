import { describe, expect, test } from "vitest";
import { isUnknownPath } from "../webPath";

/**
 * The decision behind the web app's 404.
 *
 * Worth testing rather than eyeballing, because both ways of being wrong are
 * quiet: too strict and the app 404s its own home page, too loose and a bad
 * link lands silently on Home, which is the bug this replaces.
 *
 * `isUnknownPath` is tested rather than `isUnknownWebPath` deliberately —
 * `Platform.OS` is not `"web"` under vitest, so the wrapper returns `false` for
 * every input and a test of it would pass without exercising anything.
 */
describe("isUnknownPath", () => {
  test("the paths the app actually serves are known", () => {
    for (const path of ["/", "", "/index.html", "//", "/index.html/"]) {
      expect(isUnknownPath(path), path).toBe(false);
    }
  });

  test("anything else is a 404", () => {
    for (const path of ["/orders", "/nope", "/legal", "/a/b/c"]) {
      expect(isUnknownPath(path), path).toBe(true);
    }
  });

  test("it is case-sensitive, as URLs are", () => {
    // `/Home` is not a path Wave serves, and pretending otherwise would send
    // someone to the app with a URL that stays wrong in the address bar.
    expect(isUnknownPath("/Home")).toBe(true);
  });

  test("a query string is not part of the decision", () => {
    // The Paystack return is `/?reference=...`; `pathname` excludes the query,
    // so this asserts the shape the gate is actually handed.
    expect(isUnknownPath("/")).toBe(false);
  });
});
