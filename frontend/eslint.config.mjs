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
import { reactRules, reactSettings } from './eslint.react.config.mjs';

export default defineConfig([
  globalIgnores(
    ['build/**/*', 'node_modules/'],
    'Ignore build dir and node_modules',
  ),
  js.configs.recommended,
  {
    ...reactPlugin.configs.flat.recommended,
    settings: reactSettings,
  },
  reactPlugin.configs.flat['jsx-runtime'],
  reactHooksPlugin.configs['recommended-latest'],
  eslintPluginJsxA11y.flatConfigs.recommended,
  pluginCypress.configs.recommended,
  {
    files: ['src/**/*', 'public/**/*', 'cypress/**/*', 'bin/**/*'],
    plugins: {
      'unused-imports': unusedImports, // not flat config compatible
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    languageOptions: {
      ...reactPlugin.configs.flat.recommended.languageOptions,
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.jest,
        ...globals.cypress,
        process: 'readonly',
        global: 'readonly',
        window: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        expect: 'readonly',
        beforeEach: 'readonly',
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
      // React and React Hooks rules (imported from separate config)
      ...reactRules,

      // General rules
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
    },
  },
  eslintPluginPrettierRecommended,
]);
