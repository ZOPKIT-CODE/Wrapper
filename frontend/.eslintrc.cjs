module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', '.eslintrc.cjs', 'node_modules'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': [
      'warn',
      { allowConstantExport: true },
    ],
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    // ~543 pre-existing `any`s: keep as a (non-blocking) warning so the eslint gate
    // can enforce everything else now, and burn the `any` debt down over time.
    '@typescript-eslint/no-explicit-any': 'warn',
    'no-console': ['warn', { allow: ['error'] }],
    'prefer-const': 'error',
    // Prettier owns formatting (it's the pre-commit gate); turn off the one
    // eslint:recommended formatting rule that conflicts with it (prettier emits
    // ASI-safety leading semicolons that this rule flags as "unnecessary").
    'no-extra-semi': 'off',
  },
}
