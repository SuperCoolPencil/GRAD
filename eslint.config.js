const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['android/**'],
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
    },
  },
]);
