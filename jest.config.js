const expoPreset = require('jest-expo/jest-preset');

module.exports = {
  ...expoPreset,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/ios/', '/android/', '/build/', '/dist/'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|drizzle-orm)',
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'json', 'node'],
  // The AltStore source helper is a plain .mjs module shared with the CI
  // script; teach Jest to transform it so its logic can be unit-tested.
  transform: {
    ...expoPreset.transform,
    '^.+\\.mjs$': 'babel-jest',
  },
  collectCoverageFrom: ['src/domain/**/*.ts', '!src/domain/**/*.test.ts'],
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@modules/(.*)$': '<rootDir>/modules/$1',
  },
};
