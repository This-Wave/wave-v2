import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Pure-logic tests only — no React Native renderer.
 *
 * The app's testable core (pricing, the Wave-day calendar, date formatting for
 * the API, the Paystack return hand-off) is plain TypeScript, and running it
 * does not need Metro, a simulator, or `react-native` resolved for a host
 * platform. Component and navigation coverage is a separate job (Detox/Maestro)
 * that needs a device.
 *
 * `react-native` is aliased to a stub because modules under test import
 * `Platform` from it; the real package ships Flow-typed source that esbuild
 * cannot parse. `__dirname` rather than `import.meta.url` — the app's tsconfig
 * targets CommonJS and rejects `import.meta`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "react-native": path.resolve(__dirname, "src/test/reactNativeStub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
