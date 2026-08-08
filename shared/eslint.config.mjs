import eslint from '@eslint/js';
import jsdoc from 'eslint-plugin-jsdoc';
import tseslint from 'typescript-eslint';

import { commonRules, jsdocRules } from '../scripts/eslint-house-style.mjs';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'eslint.config.mjs'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { jsdoc },
    rules: {
      ...jsdocRules,
      ...commonRules,
    },
  },
  {
    // The tests are outside the build's tsconfig; lint them without types.
    files: ['test/**/*.ts'],
    languageOptions: { parserOptions: { projectService: false } },
  },
);
