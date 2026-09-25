module.exports = function (api) {
  api.cache(true);
  // NativeWind v4: className is compiled through its JSX runtime on every
  // platform, and colours are CSS variables everywhere (PLAN-THEMES.md phase 3).
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }], "nativewind/babel"],
  };
};
