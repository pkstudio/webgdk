import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";
import stylisticTs from "@stylistic/eslint-plugin-ts";


/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
    js.configs.recommended,
    eslintConfigPrettier,
    ...tseslint.configs.recommended,
    {
        plugins: {
            turbo: turboPlugin,
            "@stylistic/ts": stylisticTs
        },
        rules: {
            "turbo/no-undeclared-env-vars": "warn",
            "@stylistic/ts/indent": ["error", 4],
            "@stylistic/ts/semi": ["error", "always"],
            "@stylistic/ts/quotes": ["error", "double"],
        },
    },
    {
        plugins: {
            onlyWarn,
        },
    },
    {
        ignores: ["dist/**"],
    },
];
