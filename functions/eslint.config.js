import js from "@eslint/js";
import prettierRecommended from "eslint-plugin-prettier/recommended";

export default [
  js.configs.recommended,
  prettierRecommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
];
