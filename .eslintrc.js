module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: { jsx: true },
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:@typescript-eslint/recommended-requiring-type-checking',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
  ],
  rules: {
    // TypeScript strict
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    
    // React
    'react/react-in-jsx-scope': 'off',
    'react-hooks/exhaustive-deps': 'warn',
    
    // i18n enforcement: no hardcoded strings in JSX
    'react/jsx-no-literals': ['warn', { noStrings: true, allowedStrings: ['✓', '✓✓', '→'] }],
    
    // Code quality
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'max-lines': ['warn', { max: 300, skipBlankLines: true, skipComments: true }],
    'no-nested-ternary': 'error',
  },
  settings: {
    react: { version: 'detect' },
  },
};
