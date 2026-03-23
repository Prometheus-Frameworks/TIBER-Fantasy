module.exports = {
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/shared/$1',
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^wouter$': '<rootDir>/client/src/__tests__/wouterMock.ts',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { ...require('./tsconfig.json').compilerOptions, jsx: 'react-jsx' } }],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  injectGlobals: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 20,
      functions: 15,
      branches: 10,
    },
  },
  coveragePathIgnorePatterns: ['/node_modules/', '/client/', '/__tests__/'],
};
