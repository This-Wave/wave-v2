/**
 * The slice of `react-native` the pure-logic modules touch.
 *
 * They import `Platform` only to branch on web-vs-native, so a stub keeps the
 * unit suite free of Metro and the Flow-typed RN source that esbuild cannot
 * parse. Tests that need to act like the web build override `Platform.OS`.
 */
export const Platform = { OS: "ios" as string, select: (o: Record<string, unknown>) => o.ios };
