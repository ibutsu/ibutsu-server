// eslint.config.mjs
import reactPlugin from 'eslint-plugin-react';
import unusedImports from 'eslint-plugin-unused-imports';
import globals from 'globals';
import babelParser from '@babel/eslint-parser';
import {defineConfig, globalIgnores} from 'eslint/config';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import js from '@eslint/js';
import pluginCypress from 'eslint-plugin-cypress/flat';

export default defineConfig([
  globalIgnores(['build/**/*', 'node_modules/'], 'Ignore build dir and node_modules'),
  pluginCypress.configs.recommended,
  reactHooksPlugin.configs['recommended-latest'],
  reactPlugin.configs.flat.recommended,
  reactPlugin.configs.flat['jsx-runtime'],
  js.configs.recommended,
  pluginCypress.configs.recommended,
  // prettier.configs.recommended
  {
    files: ['src/*', 'cypress/*', 'bin/*'],
    plugins: {
      'unused-imports': unusedImports, // not flat config compatible
      reactPlugin,
      reactHooksPlugin,
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
      'react/jsx-curly-brace-presence': [
        'error',
        {
          props: 'never',
          children: 'never',
        },
      ],
      'react/react-in-jsx-scope': 'off',
      camelcase: 'off',
      quotes: ['warn', 'single'],
      'no-duplicate-imports': 'error',
      'unused-imports/no-unused-imports': 'error',
      'unused-imports/no-unused-vars': ['warn'],
    },
    settings: {
      react:{
        version: 'detect',
      }
    },
  }
]);
