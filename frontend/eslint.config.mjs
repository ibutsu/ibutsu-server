// eslint.config.mjs
import cypress from 'eslint-plugin-cypress';
import reactPlugin from 'eslint-plugin-react';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import {defineConfig} from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
  recommendedConfig: js.configs.recommended,
});

export default defineConfig([
  ...compat.config(reactHooksPlugin.configs.recommended),
  ...compat.config(reactPlugin.configs.recommended),
  ...compat.config(js.configs.recommended),
  ...compat.config(cypress.configs.recommended),
  // ...compat.config(prettier.configs.recommended),
  {
    files: ['src/*', 'cypress/*', 'bin/*'],
    ignores: ['node_modules/*', 'build/*'],
  },
  {
    plugins: {
      js,
      reactPlugin,
      reactHooksPlugin,
      cypress,
      'unused-imports': unusedImports
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.cypress,
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
          '@babel/plugin-syntax-flow'
        ],
        babelOptions: {
          presets: [
            '@babel/preset-flow',
            '@babel/preset-env',
            '@babel/preset-react',
          ]
        },
      },
    },
    rules: {
      'cypress/no-assigning-return-values': 'error',
      'cypress/no-unnecessary-waiting': 'error',
      'cypress/assertion-before-screenshot': 'warn',
      'cypress/no-force': 'warn',
      'cypress/no-async-tests': 'error',
      'cypress/no-async-before': 'error',
      'cypress/no-pause': 'error',
      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'never',
          children: 'never',
        },
      ],

      'arrow-body-style': ['error', 'as-needed'],
      'react/react-in-jsx-scope': 'off',
      camelcase: 'off',
      'spaced-comment': 'error',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn'],
      'semi': ['error'],
      'indent': ['error', 2],
      'space-before-function-paren': ['error', 'always'],
    },
    settings: {
      react:{
        version: 'detect',
      }
    },
  }
]);
