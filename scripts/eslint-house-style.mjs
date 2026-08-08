/**
 * The house style, as lint rules.
 *
 * All three packages import this so the style is defined once. It is plain
 * data, no imports, so it resolves from any package's node_modules.
 *
 * The style, in short:
 *
 * - A comment is not required. A line that says what it does needs none. Only
 *   a line whose reason is unclear needs one. No rule here asks for a comment
 *   that is absent.
 * - A comment that is present must be complete. It accounts for every
 *   parameter it names and gives each tag a description.
 * - No types in the tags. TypeScript has them, and a second copy rots.
 */
export const jsdocRules = {
  // Well-formed to begin with.
  'jsdoc/check-alignment': 'error',
  'jsdoc/check-tag-names': ['error', { typed: true }],
  'jsdoc/no-bad-blocks': 'error',
  'jsdoc/no-multi-asterisks': ['error', { allowWhitespace: true }],
  'jsdoc/empty-tags': 'error',

  /*
   * Types live in the signature. `@param {string} name` duplicates what the
   * compiler already knows and is the first thing to go stale.
   */
  'jsdoc/no-types': 'error',
  'jsdoc/check-types': 'off',

  /*
   * Correct where it is written, rather than written everywhere.
   *
   * require-param stays off. It demands a tag per argument on every function
   * with a one-line summary. That is the boilerplate this style keeps out.
   * `@param entries Zip entries.` above a parameter called `entries` tells a
   * reader nothing.
   *
   * check-param-names still catches what misleads: a tag that names a renamed
   * or deleted parameter, or half the arguments documented and half not.
   */
  'jsdoc/require-param': 'off',
  'jsdoc/check-param-names': ['error', { checkDestructured: false, disableExtraPropertyReporting: true }],
  'jsdoc/require-param-description': 'error',
  'jsdoc/require-param-name': 'error',
  'jsdoc/require-returns-description': 'error',
  'jsdoc/require-returns-check': 'error',

  // Prose, not a filled-in form.
  'jsdoc/require-description-complete-sentence': 'off',
  'jsdoc/require-hyphen-before-param-description': ['error', 'never'],
  'jsdoc/tag-lines': ['error', 'never', { startLines: 1 }],
};

/** Rules that are not about comments but should still agree everywhere. */
export const commonRules = {
  /*
   * ignoreRestSiblings makes `const { secret, ...rest } = value` a way to drop
   * a field. Without it the omitted name reads as an unused variable, and the
   * code gets written out longhand to satisfy the rule.
   */
  '@typescript-eslint/no-unused-vars': [
    'error',
    { ignoreRestSiblings: true, argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
  ],
  '@typescript-eslint/no-explicit-any': 'error',
  eqeqeq: ['error', 'always'],
  'no-console': ['error', { allow: ['warn', 'error'] }],
};
