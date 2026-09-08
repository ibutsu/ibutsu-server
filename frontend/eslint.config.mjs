// eslint.config.mjs
import eslintReact from '@eslint-react/eslint-plugin';
import unusedImports from 'eslint-plugin-unused-imports';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import js from '@eslint/js';
import jsxA11yX from 'eslint-plugin-jsx-a11y-x';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
  globalIgnores(
    ['build/**/*', 'coverage/**/*', 'node_modules/'],
    'Ignore build dir, coverage, and node_modules',
  ),
  js.configs.recommended,
  {
    files: ['src/**/*', 'bin/**/*', 'public/**/*'],
    extends: [
      eslintReact.configs.recommended,
      eslintReact.configs['disable-conflict-eslint-plugin-react-hooks'],
      jsxA11yX.configs.recommended,
    ],
    plugins: {
      'unused-imports': unusedImports,
      'react-hooks': reactHooks,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
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
      '@eslint-react/no-nested-component-definitions': 'warn',
      '@eslint-react/no-access-state-in-setstate': 'warn',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
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
  // Vitest globals for test and test utility files
  {
    files: [
      '**/*.test.js',
      '**/*.test.jsx',
      '**/*.spec.js',
      '**/*.spec.jsx',
      'src/test-utils/**/*.js',
      'src/setupTests.js',
    ],
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
