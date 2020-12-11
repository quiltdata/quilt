module.exports = {
  collectCoverageFrom: [
    'app/**/*.{js,jsx}',
    '!app/**/*.test.{js,jsx}',
    '!app/**/mocks/*.{js,jsx}',
    '!app/*/RbGenerated*/*.{js,jsx}',
    '!app/app.js',
    '!app/global-styles.js',
    '!app/*/*/Loadable.{js,jsx}',
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
  moduleDirectories: ['node_modules', 'app'],
  moduleNameMapper: {
    '.*\\.(css|less|styl|scss|sass)$': '<rootDir>/internals/mocks/cssModule.js',
    '.*\\.(jpg|jpeg|png|gif|eot|otf|webp|svg|ttf|woff|woff2|mp4|webm|wav|mp3|m4a|aac|oga)$':
      '<rootDir>/internals/mocks/image.js',
  },
  setupFilesAfterEnv: ['<rootDir>/internals/testing/test-bundler.js'],
  setupFiles: ['raf/polyfill', 'jest-localstorage-mock'],
  testRegex: '.*\\.(test|spec)\\.js$',
  testURL: 'https://quilt-test',
  transformIgnorePatterns: [
    'node_modules/(?!(redux-form/es|connected-react-router/esm)/)',
  ],
  snapshotSerializers: [],
}
