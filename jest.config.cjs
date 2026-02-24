module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  injectGlobals: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: { global: { lines: 5 } },
  coveragePathIgnorePatterns: ['/node_modules/', '/client/', '/__tests__/'],
};
