/**
 * .eslint.js
 *
 * ESLint configuration file.
 */

import pluginVue from "eslint-plugin-vue";
import turboPlugin from "eslint-plugin-turbo";
import vueTsEslintConfig from "@vue/eslint-config-typescript";
import stylisticTs from "@stylistic/eslint-plugin-ts";


export default [
    {
        name: "app/files-to-lint",
        files: ["**/*.{ts,mts,tsx,vue}"],
    },

    {
        name: "app/files-to-ignore",
        ignores: ["**/dist/**", "**/dist-ssr/**", "**/coverage/**"],
    },

    ...pluginVue.configs["flat/recommended"],
    ...vueTsEslintConfig(),

    {
        plugins: {
            turbo: turboPlugin,
            "@stylistic/ts": stylisticTs
        },
        rules: {
            "@stylistic/ts/indent": ["error", 4],
            "@stylistic/ts/semi": ["error", "always"],
            "@stylistic/ts/quotes": ["error", "double"],
            "@typescript-eslint/no-unused-expressions": [
                "error",
                {
                    allowShortCircuit: true,
                    allowTernary: true,
                },
            ],
            "vue/multi-word-component-names": "off",
        }
    }
];
