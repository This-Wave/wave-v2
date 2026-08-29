/**
 * The slice of `react-native` the pure-logic modules touch.
 *
 * They import `Platform` only to branch on web-vs-native, so a stub keeps the
 * unit suite free of Metro and the Flow-typed RN source that esbuild cannot
 * parse. Tests that need to act like the web build override `Platform.OS`.
 */
export const Platform = { OS: "ios" as string, select: (o: Record<string, unknown>) => o.ios };

/**
 * Enough of `AccessibilityInfo` for the reduce-motion code paths. Tests spy on
 * these, so they must be real properties on a real object — `vi.spyOn` cannot
 * attach to something that does not exist.
 */
export const AccessibilityInfo = {
  isReduceMotionEnabled: async (): Promise<boolean> => false,
  addEventListener: (_event: string, _handler: (value: boolean) => void): { remove: () => void } => ({
    remove: () => undefined,
  }),
};

/**
 * `Linking`, for the maps helpers. Same requirement as `AccessibilityInfo`:
 * real properties on a real object, or `vi.spyOn` has nothing to attach to.
 * The defaults never actually open anything.
 */
export const Linking = {
  canOpenURL: async (_url: string): Promise<boolean> => false,
  openURL: async (_url: string): Promise<void> => undefined,
};

