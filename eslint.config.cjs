const tseslint = require('@typescript-eslint/eslint-plugin')
const tsParser = require('@typescript-eslint/parser')
const vue = require('eslint-plugin-vue')
const pluginImport = require('eslint-plugin-import')
const vueParser = require('vue-eslint-parser')
const vueFlat = vue.configs['flat/recommended']
const { FlatCompat } = require('@eslint/eslintrc')
const compat = new FlatCompat({ baseDirectory: __dirname })

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'src-tauri/target/**',
      '**/*.min.*',
      '**/*.generated.*',
      'coverage/**',
      '**/__tests__/**'
    ]
  },
  ...compat.extends('airbnb-base'),
  ...vueFlat,
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        ecmaVersion: 'latest',
        sourceType: 'module'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off'
    }
  },
  {
    files: ['**/*.{js,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module'
    },
    plugins: {
      '@typescript-eslint': tseslint,
      import: pluginImport
    },
    settings: {
      'import/resolver': {
        node: { extensions: ['.js', '.ts', '.vue'] }
      }
    },
    rules: {
      'no-console': 'off',
      'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }
      ]
    }
  },
  {
    files: ['**/*.d.ts', 'vitest.config.ts', 'scripts/**', 'build/**', '**/*.config.{js,ts}'],
    rules: {
      semi: 'off',
      'comma-dangle': 'off',
      'operator-linebreak': 'off',
      'max-len': ['warn', { code: 120, ignoreComments: true, ignoreStrings: true, ignoreTemplateLiterals: true }],
      'import/extensions': 'off',
      'import/no-unresolved': 'off'
    }
  }
]
