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
  pluginCypress.configs.recommended,
  reactHooksPlugin.configs['recommended-latest'],
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  js.configs.recommended,
  pluginCypress.configs.recommended,
  eslintPluginJsxA11y.flatConfigs.recommended,
  {
    files: ['src/*', 'cypress/*', 'bin/*'],
    plugins: {
      'unused-imports': unusedImports, // not flat config compatible
      reactPlugin,
      reactHooksPlugin,
      eslintPluginJsxA11y,
      pluginCypress,
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
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^React$', // Allow React import for JSX files
        },
      ],
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          varsIgnorePattern: '^React$', // Allow React import for JSX files
        },
      ],
    },
    settings: {
      react: {
        version: 'detect',
      },
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
  // Allow React imports in JSX files even if not directly used
  {
    files: ['**/*.js', '**/*.jsx'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      // Override unused-imports rules to allow React imports
      'unused-imports/no-unused-imports': 'off', // Disable for React imports
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^React$',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      'no-unused-vars': [
        'error',
        {
          vars: 'all',
          varsIgnorePattern: '^React$',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
]);
