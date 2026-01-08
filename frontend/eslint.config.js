import js from '@eslint/js';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-plugin-prettier';
import { defineConfig } from 'eslint/config';

import noCommentsPlugin from './eslint-plugin-no-comments.js';

export default defineConfig([
  /* =====================================================
   * IGNORE PATHS
   * ===================================================== */
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '*.config.js',
      'eslint-plugin-no-comments.js',
    ],
  },

  /* =====================================================
   * BASE JAVASCRIPT (FLAT SAFE)
   * ===================================================== */
  js.configs.recommended,

  /* =====================================================
   * REACT / JSX
   * ===================================================== */
  {
    files: ['**/*.{js,jsx}'],

    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },

    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
      prettier,
      'no-comments': noCommentsPlugin,
    },

    settings: {
      react: {
        version: 'detect',
      },
    },

    rules: {
      /* =====================================================
       * PRETTIER (FORMATTING OWNER)
       * ===================================================== */
      'prettier/prettier': 'error',

      /* Disable ESLint formatting rules */
      indent: 'off',
      'react/jsx-indent': 'off',
      'react/jsx-indent-props': 'off',

      /* =====================================================
       * REACT CORE (MANUAL "RECOMMENDED")
       * ===================================================== */
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',

      'react/jsx-key': 'error',
      'react/jsx-no-undef': 'error',
      'react/no-unknown-property': 'error',
      'react/no-danger-with-children': 'error',
      'react/no-direct-mutation-state': 'error',
      'react/no-deprecated': 'warn',
      'react/no-children-prop': 'warn',

      /* =====================================================
       * REACT HOOKS
       * ===================================================== */
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      /* =====================================================
       * REACT REFRESH (VITE)
       * ===================================================== */
      'react-refresh/only-export-components': 'off',

      /* =====================================================
       * CUSTOM RULES
       * ===================================================== */
      'no-comments/no-explanatory-comments': 'warn',
      'no-comments/no-empty-blocks': 'warn',

      /* =====================================================
       * PRACTICAL OVERRIDES
       * ===================================================== */
      'no-unused-vars': 'off',
    },
  },
]);
