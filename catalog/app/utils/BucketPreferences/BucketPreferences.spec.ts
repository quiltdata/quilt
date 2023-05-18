import dedent from 'dedent'

import { extendDefaults, parse } from './BucketPreferences'

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
      meta: {
        userMeta: {
          expanded: false,
        },
        workflows: {
          expanded: false,
        },
      },
    },
    nav: {
      files: true,
      packages: true,
      queries: true,
    },
    packageDescription: {
      packages: {
        '.*': {
          message: true,
        },
      },
      userMetaMultiline: false,
    },
    sourceBuckets: {
      list: [],
    },
  },
}

describe('utils/BucketPreferences', () => {
  describe('parse', () => {
    test('Empty config returns default preferences', () => {
      expect(parse('')).toMatchObject(expectedDefaults)
    })

    test('If one action is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                actions:
                    copyPackage: False
      `
      expect(parse(config).ui.actions).toMatchObject({
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
      expect(parse(config).ui.blocks).toMatchObject({
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
      expect(parse(config).ui.nav).toMatchObject({
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
      expect(parse(config)).toMatchObject(expectedDefaults)
    })

    test('Invalid config values throws error', () => {
      const config = dedent`
            ui:
                nav:
                    queries: QUERY
      `
      expect(() => parse(config)).toThrowError()
    })
  })

  describe('extendDefaults', () => {
    test('Empty config returns default preferences', () => {
      expect(extendDefaults({})).toMatchObject(expectedDefaults)
    })

    test('If one action is overwritten, others should be default', () => {
      const config = {
        ui: {
          actions: {
            deleteRevision: true,
          },
        },
      }
      expect(extendDefaults(config).ui.actions).toMatchObject({
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
      expect(extendDefaults(config).ui.blocks).toMatchObject({
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
      expect(extendDefaults(config).ui.nav).toMatchObject({
        ...expectedDefaults.ui.nav,
        files: false,
      })
    })
  })
})
