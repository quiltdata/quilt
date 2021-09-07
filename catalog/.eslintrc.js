module.exports = {
  parser: '@typescript-eslint/parser',
  extends: ['airbnb-typescript', 'prettier'],
  plugins: ['@typescript-eslint', 'redux-saga', 'react', 'react-hooks', 'jsx-a11y', 'import'],
  env: {
    jest: true,
    browser: true,
    node: true,
    es6: true,
  },
  parserOptions: {
    project: './tsconfig.json',
  },
  rules: {
    '@typescript-eslint/no-use-before-define': 0,
    // TODO: try removing this after ts migration
    '@typescript-eslint/no-throw-literal': 0,
    'arrow-body-style': [2, 'as-needed'],
    'class-methods-use-this': 0,
    'import/no-extraneous-dependencies': 0,
    'import/no-named-as-default': 0,
    'import/no-unresolved': 2,
    'import/no-webpack-loader-syntax': 0,
    'import/prefer-default-export': 0,
    'jsx-a11y/aria-props': 2,
    'jsx-a11y/label-has-associated-control': [
      2,
      {
        // NOTE: If this error triggers, either disable it or add
        // your custom components, labels and attributes via these options
        // See https://github.com/evcohen/eslint-plugin-jsx-a11y/blob/master/docs/rules/label-has-associated-control.md
        controlComponents: ['Input'],
      },
    ],
    'jsx-a11y/mouse-events-have-key-events': 2,
    'jsx-a11y/role-has-required-aria-props': 2,
    'jsx-a11y/role-supports-aria-props': 2,
    'max-classes-per-file': 0,
    'no-console': 2,
    'no-nested-ternary': 1,
    'no-underscore-dangle': [2, { allow: ['_', '__', '__typename'] }],
    'prefer-arrow-callback': [2, { allowNamedFunctions: true }],
    'prefer-template': 2,
    'react-hooks/exhaustive-deps': 2,
    'react-hooks/rules-of-hooks': 2,
    'react/destructuring-assignment': 0,
    // TODO: rm after migrating to ts
    'react/jsx-filename-extension': 0,
    'react/jsx-first-prop-new-line': [2, 'multiline'],
    'react/jsx-props-no-spreading': 0,
    'react/jsx-uses-vars': 2,
    // TODO: rm after migrating to ts
    'react/prop-types': 0,
    // TODO: rm after migrating to ts
    'react/require-default-props': 0,
    'react/static-property-placement': [2, 'static public field'],
    'redux-saga/no-yield-in-race': 2,
    'redux-saga/yield-effects': 2,
  },
  settings: {
    'import/resolver': {
      webpack: {
        config: './internals/webpack/webpack.prod.js',
      },
    },
    react: {
      version: 'detect',
    },
  },
}
