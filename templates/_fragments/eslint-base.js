/**
 * Base ESLint Configuration for Ixflare Templates
 *
 * This configuration provides sensible defaults for TypeScript projects
 * targeting Cloudflare Workers. Import and extend this in template-specific
 * ESLint configs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    es2024: true,
    worker: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'import'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
  ],
  rules: {
    // TypeScript specific
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': 'error',

    // Import ordering (matches project-context.md rules)
    'import/order': [
      'error',
      {
        groups: ['builtin', 'external', 'type', 'internal', ['parent', 'sibling'], 'index'],
        pathGroups: [
          { pattern: '@/components/**', group: 'internal', position: 'after' },
          { pattern: '@/features/**', group: 'internal', position: 'after' },
          { pattern: '@/utils/**', group: 'internal', position: 'after' },
          { pattern: '@/types/**', group: 'type', position: 'after' },
        ],
        pathGroupsExcludedImportTypes: ['type'],
        'newlines-between': 'always',
        alphabetize: { order: 'asc', caseInsensitive: true },
      },
    ],

    // General code quality
    'no-console': 'warn',
    'no-debugger': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    eqeqeq: ['error', 'always'],
    curly: ['error', 'all'],

    // Edge runtime specific - disallow Node.js APIs
    'no-restricted-globals': [
      'error',
      {
        name: 'Buffer',
        message: 'Buffer is not available in Cloudflare Workers. Use Uint8Array.',
      },
      {
        name: 'process',
        message: 'process is not available in Cloudflare Workers. Use env bindings.',
      },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['fs', 'fs/*', 'path', 'os', 'child_process', 'cluster'],
            message: 'Node.js built-in modules are not available in Cloudflare Workers.',
          },
        ],
      },
    ],
  },
  ignorePatterns: ['node_modules', 'dist', '.wrangler', '*.config.js', '*.config.ts'],
}
