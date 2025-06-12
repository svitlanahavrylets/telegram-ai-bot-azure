import js from "@eslint/js";
import globals from "globals";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: { js, react: pluginReact },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    extends: [
      "js/recommended",
      "airbnb-base",
      pluginReact.configs.flat.recommended,
    ],
    env: {
      es2021: true,
      node: true,
    },
    rules: {
      "no-unused-vars": [
        "warn",
        { vars: "all", args: "after-used", ignoreRestSiblings: false },
      ],
    },
  },
]);
