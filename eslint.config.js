import tsParser from "@typescript-eslint/parser";

export default [
  {
    ignores: ["node_modules/**", "dist/**", "*.config.*", "drizzle/**", "*.js", "*.cjs", "*.mjs"]
  },
  {
    files: ["client/src/**/*.{ts,tsx}", "server/**/*.{ts,tsx}", "shared/**/*.ts"],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "window",
          property: "location",
          message: "Use wouter setLocation() — no hard reloads."
        }
      ]
    }
  }
];
