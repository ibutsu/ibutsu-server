// eslint.config.mjs
import cypress from 'eslint-plugin-cypress';
import react from 'eslint-plugin-react';
import prettier from 'eslint-plugin-prettier';
import unusedImports from 'eslint-plugin-unused-imports';
import { fileURLToPath } from 'node:url';
import globals from 'globals';
import path from 'node:path';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import reactHooks from 'eslint-plugin-react-hooks';
import pkg from '@babel/eslint-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  {
    files: ['src/*', 'cypress/*', 'bin/*'],
    ignores: ['node_modules/*', 'build/*'],
  },
  ...compat.extends(
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'plugin:cypress/recommended',
    'prettier',
  ),
  {
    plugins: {
      cypress,
      prettier,
      react,
      'unused-imports': unusedImports,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.cypress,
        es2020: true,
      },
      parser: pkg,
      parserOptions: {
        ecmaVersion: 2020,
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
];
