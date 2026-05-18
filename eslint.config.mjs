import js from "@eslint/js";
import tseslint from "typescript-eslint";

const tsRecommended = tseslint.configs.recommended;

export default tseslint.config(
  {
    ignores: [
      "clients/**",
      "dist/**",
      "node_modules/**",
      ".wrangler/**",
      "pages/**",
      "package-lock.json",
    ],
  },
  js.configs.recommended,
  ...tsRecommended,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
