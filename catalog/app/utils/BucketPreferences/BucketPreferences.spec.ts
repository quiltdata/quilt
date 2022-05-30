import { parse } from './BucketPreferences'

const sentryMock = () => {}

const expectedDefaults = {
  ui: {
    actions: {
      copyPackage: true,
      createPackage: true,
      deleteRevision: false,
      revisePackage: true,
    },
    blocks: {
      analytics: true,
      browser: true,
      code: true,
      meta: true,
    },
    nav: {
      files: true,
      packages: true,
      queries: true,
    },
    sourceBuckets: {
      list: [],
    },
  },
}

describe('utils/BucketPreferences', () => {
  describe('parse', () => {
    test('Empty config returns default preferences', () => {
      expect(parse('', sentryMock)).toMatchObject(expectedDefaults)
    })
  })

  describe.skip('extend', () => {})
})
