module.exports = {
  root: true,
  extends: ["../../.eslintrc.base.cjs"],
  env: { node: true, es2022: true },
  overrides: [
    {
      files: ["**/__tests__/**/*.ts"],
      env: { node: true },
      rules: {
        // Tests assert on loosely-shaped API payloads and mock returns.
        "@typescript-eslint/no-explicit-any": "off",
      },
    },
  ],
};
