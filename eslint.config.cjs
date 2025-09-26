const { defineConfig } = require('eslint/config');

const tsParser = require('@typescript-eslint/parser');
const typescriptEslint = require('@typescript-eslint/eslint-plugin');

module.exports = defineConfig([
  {},
  {
    files: ['src/**/*.ts'],

    languageOptions: {
      parser: tsParser,

      parserOptions: {
        project: 'tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
    },

    plugins: {
      '@typescript-eslint': typescriptEslint,
    },

    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
]);
