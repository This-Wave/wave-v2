/**
 * Shared TypeScript lint base for the workspaces that are not Next.js.
 * `apps/admin` extends `next/core-web-vitals` instead, which already bundles
 * an equivalent TypeScript setup.
 *
 * Deliberately not type-aware (no `parserOptions.project`): the type-aware rule
 * set needs a full program per lint run, and `npm run type-check` already runs
 * tsc in strict mode across every workspace, so it would be paying twice for
 * the same answers.
 */
module.exports = {
  root: false,
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    // Unused args are usually a deliberate signature match (Fastify handlers
    // take `request` even when they only use `reply`), so allow the _ prefix.
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
    ],
    // The codebase uses `!` on request.user after an authenticate preHandler
    // has already guaranteed it. Flagging every one would be noise.
    "@typescript-eslint/no-non-null-assertion": "off",
    "no-empty": ["error", { allowEmptyCatch: true }],
  },
  ignorePatterns: ["dist/", "node_modules/", "*.config.js", "*.config.cjs"],
};
