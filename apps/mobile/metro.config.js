const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// npm workspaces hoist shared deps (expo, react, etc.) to the repo root —
// Metro needs to watch and resolve from there too, not just apps/mobile.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// `.cjs` so Metro can load @wave/shared/palettes.cjs, the one colour table.
if (!config.resolver.sourceExts.includes("cjs")) config.resolver.sourceExts.push("cjs");

// NativeWind v4 compiles global.css (Tailwind + the theme variables) for
// native as well as web.
module.exports = withNativeWind(config, { input: "./global.css" });
