/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/test/e2e/**/*.test.js'],
  // Increase timeout for DB-heavy tests
  testTimeout: 30000,
};
