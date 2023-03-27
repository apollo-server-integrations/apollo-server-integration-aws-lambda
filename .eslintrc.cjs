module.exports = {
  overrides: [
    {
      files: ['src/**/*.ts'],
      parser: '@typescript-eslint/parser',
      plugins: ['@typescript-eslint'],
      parserOptions: {
        project: 'tsconfig.eslint.json',
        tsconfigRootDir: __dirname,
      },
      rules: {
        '@typescript-eslint/consistent-type-imports': 'error',
      },
    },
  ],
  root: true,
};
