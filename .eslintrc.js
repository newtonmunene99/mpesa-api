module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'jsdoc'],
  extends: [
    'plugin:jsdoc/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier',
    'prettier/@typescript-eslint',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
  },
  rules: {
    'jsdoc/require-returns': 'off',
    'no-else-return': 'warn',
    '@typescript-eslint/interface-name-prefix': 'off',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-misused-promises': 'warn',
    '@typescript-eslint/switch-exhaustiveness-check': 'error',
    '@typescript-eslint/prefer-string-starts-ends-with': 'error',
    'no-extra-parens': 'off',
    '@typescript-eslint/no-extra-parens': ['off'],
    camelcase: 'off',
    '@typescript-eslint/member-ordering': [
      'warn',
      {
        default: [
          // Index signature
          'signature',

          // Fields
          'private-static-field',
          'protected-static-field',
          'public-static-field',

          'private-decorated-field',
          'protected-decorated-field',
          'public-decorated-field',

          'private-instance-field',
          'protected-instance-field',
          'public-instance-field',

          'private-abstract-field',
          'protected-abstract-field',
          'public-abstract-field',

          'private-field',
          'protected-field',
          'public-field',

          'static-field',
          'abstract-field',
          'instance-field',

          'decorated-field',

          'field',

          // Constructors
          'private-constructor',
          'protected-constructor',
          'public-constructor',

          'constructor',

          // Methods

          'private-static-method',
          'protected-static-method',
          'public-static-method',

          'private-decorated-method',
          'protected-decorated-method',
          'public-decorated-method',

          'private-instance-method',
          'protected-instance-method',
          'public-instance-method',

          'private-abstract-method',
          'protected-abstract-method',
          'public-abstract-method',

          'private-method',
          'protected-method',
          'public-method',

          'static-method',
          'abstract-method',
          'instance-method',

          'decorated-method',

          'method',
        ],
      },
    ],
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase'],
      },
      {
        selector: 'property',
        format: ['camelCase', 'PascalCase'],
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
      },
      {
        selector: 'parameter',
        format: ['camelCase', 'PascalCase'],
        leadingUnderscore: 'allow',
      },

      {
        selector: 'memberLike',
        modifiers: ['private'],
        format: ['camelCase'],
        leadingUnderscore: 'allow',
      },

      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
    ],
  },
};
