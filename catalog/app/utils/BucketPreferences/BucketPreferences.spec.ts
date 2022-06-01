import dedent from 'dedent'

import { extendDefaults, parse } from './BucketPreferences'

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
      expect(parse(config, sentryMock).ui.actions).toMatchObject({
        ...expectedDefaults.ui.actions,
        copyPackage: false,
      })
    })

    test('If one block is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                blocks:
                    analytics: False
      `
      expect(parse(config, sentryMock).ui.blocks).toMatchObject({
        ...expectedDefaults.ui.blocks,
        analytics: false,
      })
    })

    test('If one nav is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                nav:
                    queries: False
      `
      expect(parse(config, sentryMock).ui.nav).toMatchObject({
        ...expectedDefaults.ui.nav,
        queries: false,
      })
    })

    test('Additional config structures returns defaults', () => {
      const config = dedent`
            ui:
                blocks:
                    queries: QUERY
      `
      expect(parse(config, sentryMock)).toMatchObject(expectedDefaults)
    })

    test('Invalid config values throws error', () => {
      const config = dedent`
            ui:
                nav:
                    queries: QUERY
      `
      expect(() => parse(config, sentryMock)).toThrowError()
    })
  })

  describe('extendDefaults', () => {
    test('Empty config returns default preferences', () => {
      expect(extendDefaults({}, sentryMock)).toMatchObject(expectedDefaults)
    })

    test('If one action is overwritten, others should be default', () => {
      const config = {
        ui: {
          actions: {
            deleteRevision: true,
          },
        },
      }
      expect(extendDefaults(config, sentryMock).ui.actions).toMatchObject({
        ...expectedDefaults.ui.actions,
        deleteRevision: true,
      })
    })

    test('If one block is overwritten, others should be default', () => {
      const config = {
        ui: {
          blocks: {
            browser: false,
          },
        },
      }
      expect(extendDefaults(config, sentryMock).ui.blocks).toMatchObject({
        ...expectedDefaults.ui.blocks,
        browser: false,
      })
    })

    test('If one nav is overwritten, others should be default', () => {
      const config = {
        ui: {
          nav: {
            files: false,
          },
        },
      }
      expect(extendDefaults(config, sentryMock).ui.nav).toMatchObject({
        ...expectedDefaults.ui.nav,
        files: false,
      })
    })
  })
})
