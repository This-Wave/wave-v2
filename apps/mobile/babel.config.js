module.exports = function (api) {
  // The web build reads its colours from CSS variables so the theme can change
  // at runtime (PLAN-THEMES.md §3); native keeps tailwind.config.js. Reading
  // the caller also keys Babel's cache per platform.
  const platform = api.caller((caller) => caller && caller.platform);
  return {
    presets: ["babel-preset-expo"],
    plugins: [
      platform === "web"
        ? ["nativewind/babel", { tailwindConfigPath: "./tailwind.web.config.js" }]
        : "nativewind/babel",
    ],
  };
};
