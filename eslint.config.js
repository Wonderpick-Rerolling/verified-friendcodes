import prettier from 'eslint-plugin-prettier/recommended';
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    ignores: ['.wrangler/*, ahk-scripts/*, .git/*, coverage/*, node_modules/*'],
  },
  js.configs.recommended,
  prettier,
];