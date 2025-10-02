// eslint.react.config.mjs
// Extracted React and React Hooks rules configuration

export const reactRules = {
  // Strict React rules
  'react/jsx-curly-brace-presence': [
    'error',
    {
      props: 'never',
      children: 'never',
    },
  ],
  'react/react-in-jsx-scope': 'off',
  'react/jsx-uses-react': 'off',
  'react/jsx-uses-vars': 'error',
  'react/prop-types': 'error',
  'react/no-unused-prop-types': 'error',
  'react/no-unused-state': 'error',
  'react/jsx-key': 'error',
  'react/jsx-no-duplicate-props': 'error',
  'react/no-direct-mutation-state': 'error',
  'react/no-deprecated': 'error',
  'react/jsx-pascal-case': 'error',
  'react/jsx-no-undef': 'error',
  'react/jsx-no-bind': ['error', { allowArrowFunctions: true }],

  // Strict React Hooks rules
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'error',
};

export const reactSettings = {
  react: {
    version: '18.3',
  },
};
