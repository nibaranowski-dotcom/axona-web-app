// Root config — governs root-level files (e.g. src/scripts). Each workspace
// package has its own root:true config, so ESLint uses the closest one per file.
module.exports = {
  root: true,
  extends: [require.resolve("@axona/config/eslint")],
  ignorePatterns: ["apps", "packages", "node_modules", "dist", ".next"],
};
