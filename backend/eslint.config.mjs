import eslint from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config({
  files: ["src/**/*.ts", "test/**/*.ts"],
  extends: [eslint.configs.recommended, ...tseslint.configs.recommended],
  rules: { "@typescript-eslint/no-explicit-any": "off" },
});
