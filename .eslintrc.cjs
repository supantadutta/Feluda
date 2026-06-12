/* Root ESLint config for the Feluda monorepo. */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
  ],
  env: {
    node: true,
    browser: true,
    es2022: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': [
      'warn',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    // Layer interfaces intentionally declare params on not-yet-implemented stubs.
    '@typescript-eslint/no-empty-function': 'off',
  },
  ignorePatterns: [
    'node_modules',
    'dist',
    'build',
    'coverage',
    'dev-dist',
    '*.config.ts',
    '*.config.js',
    '*.cjs',
  ],
};
