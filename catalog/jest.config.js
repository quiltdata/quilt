const path = require('path')

module.exports = {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    url: 'https://quilt-test'
  },
  collectCoverageFrom: [
    'app/**/*.{j,t}s{,x}',
    '!app/**/*.test.{j,t}s{,x}',
    '!app/**/mocks/*.{j,t}s{,x}',
    '!app/*/RbGenerated*/*.{j,t}s{,x}',
    '!app/app.{j,t}s{,x}',
    '!app/global-styles.{j,t}s{,x}',
    '!app/*/*/Loadable.{j,t}s{,x}',
  ],
  // TODO: increase this gradually while writing the new tests
  coverageThreshold: {
    global: {
      statements: 4,
      branches: 3,
      functions: 2,
      lines: 4,
    },
  },
  moduleDirectories: ['node_modules', 'app', path.resolve(__dirname, '../shared')],
  // TODO: convert mocks to ts?
  moduleNameMapper: {
    '.*\\.(css|less|styl|scss|sass)$': '<rootDir>/internals/mocks/cssModule.js',
    '.*\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/internals/mocks/image.js',
  },
  setupFiles: ['jest-localstorage-mock', './setup-jest.ts'],
  testRegex: '.*\\.(test|spec)\\.[jt]sx?$',
  snapshotSerializers: [],
}
