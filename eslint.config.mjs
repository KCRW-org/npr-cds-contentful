import { globalIgnores } from "eslint/config";
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from "globals";

export default tseslint.config(
    [globalIgnores(["node_modules/**/*.js", "build/*", "src/**/*.spec.tsx", "src/**/mocks/*.ts"]),
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.browser,
            ...globals.jest,
        },

        ecmaVersion: "latest",
        sourceType: "module",
    },
    rules: {
        "no-console": "off",
        "no-undef": 2,
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-unused-vars": "warn",
        "@typescript-eslint/no-require-imports": "warn",
    },
}]);