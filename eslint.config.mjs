import js from "@eslint/js";

export default [
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
  {
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
