/**
 * @axona/config — shared ESLint base (TypeScript + Prettier compatibility).
 * No type-aware rules (no parserOptions.project) so it stays fast.
 * Consumed via: extends: [require.resolve("@axona/config/eslint")]
 */
module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: 2022, sourceType: "module" },
  plugins: ["@typescript-eslint"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier", // eslint-config-prettier — turns off rules that fight Prettier
  ],
  env: { node: true, es2022: true },
  ignorePatterns: ["dist", ".next", "node_modules"],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
};
