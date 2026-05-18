import js from "@eslint/js";
import tseslint from "typescript-eslint";

const tsRecommended = tseslint.configs.recommended;

export default tseslint.config(
  {
    ignores: [
      "engines/**",
      "dist/**",
      "node_modules/**",
      ".wrangler/**",
      "apps/**",
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
