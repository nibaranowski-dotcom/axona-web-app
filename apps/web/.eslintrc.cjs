module.exports = {
  root: true,
  extends: [
    "next/core-web-vitals",
    require.resolve("@axona/config/eslint"),
    "prettier",
  ],
};
