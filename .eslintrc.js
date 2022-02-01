module.exports = {
  env: {
    browser: false,
    es2021: true,
    mocha: true,
    node: true,
  },
  plugins: ["@typescript-eslint"],
  extends: [
    "standard",
    "plugin:prettier/recommended",
    "plugin:node/recommended",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 12,
  },
  rules: {
    "node/no-unsupported-features/es-syntax": [
      "error",
      { ignores: ["modules"] },
    ],
  },
  overrides: [
    {
      files: ["*.ts"],
      rules: {
        "node/no-missing-import": "off",
      },
    },
    {
      files: ["*.test.ts", "*.spec.ts"],
      rules: {
        "no-unused-expressions": "off",
        camelcase: "off",
      },
    },
  ],
};
