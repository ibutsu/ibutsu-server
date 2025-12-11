// eslint.config.mjs
import reactPlugin from 'eslint-plugin-react';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import js from '@eslint/js';
import pluginCypress from 'eslint-plugin-cypress/flat';
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';

export default defineConfig([
  globalIgnores(
    ['build/**/*', 'node_modules/'],
    'Ignore build dir and node_modules',
  ),
  js.configs.recommended,
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  eslintPluginJsxA11y.flatConfigs.recommended,
  pluginCypress.configs.recommended,
  // Global settings for React
  {
    settings: {
      react: {
        version: '18.3.1',
      },
    },
  },
  {
    files: ['src/**/*', 'cypress/**/*', 'bin/**/*'],
    plugins: {
      'unused-imports': unusedImports, // not flat config compatible
      'react-hooks': reactHooksPlugin,
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.cypress,
        process: 'readonly', // Explicitly define process for build-time env vars
        es2020: true,
      },
      parser: babelParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        requireConfigFile: false,
        plugins: [
          '@babel/plugin-transform-class-properties',
          '@babel/plugin-transform-private-methods',
          '@babel/plugin-syntax-jsx',
          '@babel/plugin-syntax-flow',
        ],
        babelOptions: {
          presets: [
            '@babel/preset-flow',
            '@babel/preset-env',
            '@babel/preset-react',
          ],
        },
      },
    },
    rules: {
      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'never',
          children: 'never',
        },
      ],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'no-unused-vars': 'off', // Turn off base rule in favor of unused-imports
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
  // Specific configuration for service-worker.js to handle process.env
  {
    files: ['src/pages/service-worker.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        process: 'readonly', // Allow process for build-time environment variables
      },
    },
  },
  // Specific configuration for test files to handle Jest globals
  {
    files: ['**/*.test.js', '**/*.test.jsx', '**/*.spec.js', '**/*.spec.jsx'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest, // Add Jest globals for test files
      },
    },
  },
  // Specific configuration for test utility files to handle Jest globals
  {
    files: ['src/test-utils/**/*.js', 'src/setupTests.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest, // Add Jest globals for test utility files
      },
    },
  },
  eslintPluginPrettierRecommended,
]);
