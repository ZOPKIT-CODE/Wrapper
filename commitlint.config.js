module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', [
      'feat', 'fix', 'docs', 'style', 'refactor', 'perf',
      'test', 'chore', 'ci', 'build', 'revert'
    ]],
    'subject-case': [0], // Allow any case
    'body-max-line-length': [0], // Allow any body line length
  },
};
