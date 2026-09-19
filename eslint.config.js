const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');

module.exports = [
  ...expoConfig,
  prettierConfig,
  {
    ignores: [
      'node_modules/**',
      'ios/**',
      'android/**',
      'build/**',
      'dist/**',
      'drizzle/**',
      '.expo/**',
      'modules/alarm-kit/ios/**',
    ],
  },
  {
    rules: {
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'import/no-unresolved': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', 'scripts/**/*.mjs', 'jest.setup.js'],
    rules: {
      'no-console': 'off',
    },
  },
];
