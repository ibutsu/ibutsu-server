// eslint.config.mjs
import eslintReact from '@eslint-react/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import js from '@eslint/js';
import pluginCypress from 'eslint-plugin-cypress';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
  globalIgnores(
    ['build/**/*', 'node_modules/'],
    'Ignore build dir and node_modules',
  ),
  js.configs.recommended,
  // TODO: Re-enable eslint-plugin-jsx-a11y when ESLint 10 support is released
  // Tracking: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y/issues/1075
  pluginCypress.configs.recommended,
  {
    files: ['src/**/*', 'cypress/**/*', 'bin/**/*'],
    extends: [eslintReact.configs.recommended],
    plugins: {
      'unused-imports': unusedImports,
      'react-hooks': reactHooksPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.cypress,
        es2020: true,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@eslint-react/component-hook-factories': 'warn',
      '@eslint-react/no-nested-component-definitions': 'warn',
      '@eslint-react/no-access-state-in-setstate': 'warn',
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off',
      'unused-imports/no-unused-imports': 'error',
    },
  },
  // Override no-unused-vars globally to use unused-imports instead
  {
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  // Vitest globals for test files
  {
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  // Vitest globals for test utility files
  {
    files: ['src/test-utils/**/*.js', 'src/setupTests.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        vi: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        afterAll: 'readonly',
      },
    },
  },
  eslintPluginPrettierRecommended,
]);
