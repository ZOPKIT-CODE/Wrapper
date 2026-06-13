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
  overrides: [
    {
      files: ['src/lib/logger.ts', 'src/features/onboarding/utils/onboardingLogger.ts', 'src/main.tsx'],
      rules: { 'no-console': 'off' },
    },
    {
      files: [
        'src/components/ui/**/*.{ts,tsx}',
        'src/contexts/**/*.{ts,tsx}',
        'src/routes/router.tsx',
        'src/lib/auth/cognito-auth.tsx',
        'src/components/theme/ThemeProvider.tsx',
        'src/components/forms/contexts/**/*.{ts,tsx}',
        'src/components/common/feedback/**/*.{ts,tsx}',
        'src/components/route-breadcrumb.tsx',
        'src/components/common/UserAvatar.tsx',
        'src/features/landing/components/Icons.tsx',
        'src/features/landing/components/LandingCapabilityIllustrations.tsx',
        'src/features/landing/components/OrbitalEcosystem.tsx',
        'src/features/landing/landing-screenshots.tsx',
        'src/features/notifications/SeasonalCreditsCongratulatoryModal.tsx',
        'src/features/onboarding/components/OnboardingForm.tsx',
        'src/features/roles/PermissionRefreshNotification.tsx',
        'src/features/applications/components/HeroAgentDemo.tsx',
      ],
      rules: { 'react-refresh/only-export-components': 'off' },
    },
    {
      files: ['src/features/**/*.{ts,tsx}'],
      rules: {
        // Phase 0: warn on new hardcoded palette usage — burn down existing debt over time.
        'no-restricted-syntax': [
          'warn',
          {
            selector:
              'JSXAttribute[name.name="className"] Literal[value=/\\bbg-(gray|slate|zinc|stone|neutral)-/]',
            message:
              'Prefer semantic tokens (bg-background, bg-muted, bg-card) over Tailwind gray/slate palette classes.',
          },
          {
            selector:
              'JSXAttribute[name.name="className"] Literal[value=/\\btext-(gray|slate|zinc|stone|neutral)-/]',
            message:
              'Prefer text-foreground or text-muted-foreground over gray/slate text classes.',
          },
          {
            selector:
              'JSXAttribute[name.name="className"] Literal[value=/\\bborder-(gray|slate|zinc|stone|neutral)-/]',
            message:
              'Prefer border-border over gray/slate border classes.',
          },
          {
            selector:
              'JSXAttribute[name.name="className"] Literal[value=/#[0-9a-fA-F]{3,8}/]',
            message:
              'Avoid hardcoded hex in className. Use design tokens or CSS variables.',
          },
        ],
      },
    },
  ],
}
