import eslint from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  eslint.configs.recommended,
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", ".artifacts/**"],
  },
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["**/*.test.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["src/**/*.test.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        chrome: "readonly",
        ...Object.fromEntries(
          [
            "describe",
            "expect",
            "it",
            "test",
            "vi",
            "beforeEach",
            "afterEach",
            "beforeAll",
            "afterAll",
          ].map((name) => [name, "readonly"])
        ),
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.config.ts", "vitest.config.ts"],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      globals: globals.node,
    },
  }
);
