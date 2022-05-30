import dedent from 'dedent'

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

    test('If one action is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                actions:
                    copyPackage: False
      `
      const result = parse(config, sentryMock)
      expect(result.ui.actions.copyPackage).toBe(false)
      expect(result.ui.actions.createPackage).toBe(true)
      expect(result.ui.actions.deleteRevision).toBe(false)
    })

    test('If one block is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                blocks:
                    analytics: False
      `
      const result = parse(config, sentryMock)
      expect(result.ui.blocks.analytics).toBe(false)
      expect(result.ui.blocks.browser).toBe(true)
      expect(result.ui.blocks.code).toBe(true)
    })
  })

  describe.skip('extend', () => {})
})
