module.exports = {
  root: true,
  extends: [
    "../../.eslintrc.base.cjs",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
    // Catches the mechanical half of the accessibility work: a Pressable with
    // no role, a role with no label, a touchable smaller than the minimum. The
    // half it cannot catch — whether a label says anything useful — is what the
    // screen-reader traversal in docs/accessibility-device-checks.md is for.
    "plugin:react-native-a11y/all",
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
    // Deliberately off, against the plugin's own default.
    //
    // The rule demands an accessibilityHint on every element that has a label.
    // Both platforms say the opposite: a hint describes the *result* of an
    // action and Apple's guidance is to supply one "only if the result isn't
    // obvious from the label"; Android's is the same. WCAG requires no hint at
    // all. Satisfying this rule meant 53 of them, and a shop card labelled
    // "Mama Put Kitchen" gains nothing from being told "Opens the shop" — it
    // just makes every swipe longer for the people who can least afford it.
    //
    // Hints are written here where the result genuinely is not obvious: what a
    // switch will do when flipped, that a phone field excludes the +233 it
    // shows, that the photo slot replaces rather than adds, what "Finish
    // paying" reopens. Judgement, not coverage.
    "react-native-a11y/has-accessibility-hint": "off",
  },
};
