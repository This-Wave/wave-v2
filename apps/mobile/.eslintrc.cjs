module.exports = {
  root: true,
  extends: [
    "../../.eslintrc.base.cjs",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  env: { es2022: true },
  globals: {
    // React Native injects these; without them `no-undef` flags every use.
    __DEV__: "readonly",
    console: "readonly",
    fetch: "readonly",
    setTimeout: "readonly",
    clearTimeout: "readonly",
    setInterval: "readonly",
    clearInterval: "readonly",
  },
  settings: { react: { version: "detect" } },
  rules: {
    // The New JSX Transform means React need not be in scope, and prop-types
    // are redundant in a TypeScript codebase.
    "react/react-in-jsx-scope": "off",
    "react/prop-types": "off",
    // A react-dom rule that does not hold here: its suggested fix is HTML
    // entities, and a React Native <Text> renders "&apos;" literally rather
    // than decoding it. Following it would visibly corrupt user-facing copy.
    "react/no-unescaped-entities": "off",
  },
};
