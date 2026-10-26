module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['api/**/*.js', 'lib/**/*.js'],
  clearMocks: true,
  restoreMocks: true,
};
