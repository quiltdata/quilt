import dedent from 'dedent'

import { extendDefaults, parse } from './BucketPreferences'

const expectedDefaults = {
  ui: {
    actions: {
      copyPackage: true,
      createPackage: true,
      deleteRevision: false,
      downloadObject: true,
      downloadPackage: true,
      openInDesktop: true,
      revisePackage: true,
      writeFile: true,
    },
    athena: {},
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
      gallery: {
        files: true,
        overview: true,
        packages: true,
        summarize: true,
      },
      qurator: true,
    },
    nav: {
      files: true,
      workflows: true,
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
      list: ['test-bucket'],
    },
  },
}

describe('utils/BucketPreferences', () => {
  describe('parse', () => {
    it('Empty config returns default preferences', () => {
      expect(parse('', 'test-bucket')).toMatchObject(expectedDefaults)
    })

    it('If one action is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                actions:
                    copyPackage: False
      `
      expect(parse(config, 'test-bucket').ui.actions).toEqual({
        ...expectedDefaults.ui.actions,
        copyPackage: false,
      })
    })

    it('If one block is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                blocks:
                    analytics: False
      `
      expect(parse(config, 'test-bucket').ui.blocks).toEqual({
        ...expectedDefaults.ui.blocks,
        analytics: false,
      })
    })

    it('If one nav is overwritten, others should be default', () => {
      const config = dedent`
            ui:
                nav:
                    queries: False
      `
      expect(parse(config, 'test-bucket').ui.nav).toEqual({
        ...expectedDefaults.ui.nav,
        queries: false,
      })
    })

    it('Additional config structures returns defaults and those additonal fields', () => {
      const config = dedent`
            ui:
                blocks:
                    queries: QUERY
      `
      expect(parse(config, 'test-bucket')).toMatchObject(expectedDefaults)
      expect(parse(config, 'test-bucket').ui.blocks).toEqual({
        ...expectedDefaults.ui.blocks,
        queries: 'QUERY',
      })
    })

    it('Invalid config values throws error', () => {
      const config = dedent`
            ui:
                nav:
                    queries: QUERY
      `
      expect(() => parse(config, 'test-bucket')).toThrow()
    })

    it('Actions = false disables all actions', () => {
      const config = dedent`
            ui:
                actions: False
      `
      expect(parse(config, 'test-bucket').ui.actions).toMatchSnapshot()
    })
  })

  describe('extendDefaults', () => {
    it('Empty config returns default preferences', () => {
      expect(extendDefaults({}, 'test-bucket')).toMatchObject(expectedDefaults)
    })

    it('If one action is overwritten, others should be default', () => {
      const config = {
        ui: {
          actions: {
            deleteRevision: true,
          },
        },
      }
      expect(extendDefaults(config).ui.actions).toEqual({
        ...expectedDefaults.ui.actions,
        deleteRevision: true,
      })
    })

    it('If one block is overwritten, others should be default', () => {
      const config = {
        ui: {
          blocks: {
            browser: false,
          },
        },
      }
      expect(extendDefaults(config).ui.blocks).toEqual({
        ...expectedDefaults.ui.blocks,
        browser: false,
      })
    })

    it('If one nav is overwritten, others should be default', () => {
      const config = {
        ui: {
          nav: {
            files: false,
          },
        },
      }
      expect(extendDefaults(config).ui.nav).toEqual({
        ...expectedDefaults.ui.nav,
        files: false,
      })
    })
  })
})
