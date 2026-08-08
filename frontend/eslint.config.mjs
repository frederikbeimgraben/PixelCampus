// @ts-check
import eslint from '@eslint/js';
import angular from 'angular-eslint';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

import { commonRules, jsdocRules } from '../scripts/eslint-house-style.mjs';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      '.angular/**',
      'assets-library/**',
      'playwright-report/**',
      'test-results/**',
      // Generated: the contract is linted where it is written, in shared/.
      'src/contract/**',
      'src/app/core/config/env.generated.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...tseslint.configs.stylistic,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    plugins: { jsdoc },
    rules: {
      ...jsdocRules,
      ...commonRules,
      '@angular-eslint/directive-selector': [
        'error',
        { type: 'attribute', prefix: 'app', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'app', style: 'kebab-case' },
      ],
      // The code base is signal-based; enforce the modern authoring surface.
      '@angular-eslint/prefer-signals': 'error',
      '@angular-eslint/prefer-output-readonly': 'error',
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended, ...angular.configs.templateAccessibility],
    rules: {},
  },
);
