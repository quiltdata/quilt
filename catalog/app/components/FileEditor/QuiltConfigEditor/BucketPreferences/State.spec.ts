import * as R from 'ramda'

import * as legacyBucketPreferences from 'utils/BucketPreferences/BucketPreferences'
import type { PackagePreferencesInput } from 'utils/BucketPreferences/BucketPreferences'
import { parse, stringify } from './State'
import type { Config } from './State'

const legacyPrefs = legacyBucketPreferences.parse('')
function getLegacyValue(key: keyof Config) {
  switch (key) {
    case 'ui.athena.defaultWorkgroup':
      // In the legacy implementation it is `undefined`
      return ''
    case 'ui.blocks.meta.user_meta.expanded':
      return R.path('ui.blocks.meta.userMeta.expanded'.split('.'), legacyPrefs)
    case 'ui.blocks.meta':
      // In the legacy implementation it was substituted with default inner values
      // but in new implementation these values lays flat in the root
      return true
    case 'ui.package_description':
      // In the legacy implementation userMeta is `undefined`
      return Object.entries(legacyPrefs.ui.packageDescription.packages).reduce(
        (memo, entry) => {
          const [k, value] = entry
          memo[k] = value.userMeta === undefined ? { ...value, user_meta: [] } : value
          return memo
        },
        {} as Record<string, PackagePreferencesInput>,
      )
    case 'ui.package_description.multiline':
      return legacyPrefs.ui.packageDescription.userMetaMultiline
    case 'ui.source_buckets':
      return legacyPrefs.ui.sourceBuckets.list
    case 'ui.source_buckets.default':
      return legacyPrefs.ui.sourceBuckets.getDefault()
    default:
      return R.path(key.split('.'), legacyPrefs)
  }
}

describe('components/FileEditor/QuiltConfigEditor/BucketPreferences/State', () => {
  describe('stringify', () => {
    it('should stringify a config object', () => {
      const config = parse('', {})
      config['ui.nav.files'] = {
        isDefault: false,
        key: 'ui.nav.files',
        value: true,
      }
      expect(stringify(config)).toBe(JSON.stringify({ ui: { nav: { files: true } } }))
    })
  })

  describe('parse', () => {
    describe('new implementation should have the same defaults as old one', () => {
      const config = parse('', {})

      const configKeys = Object.keys(config)
      test.each(configKeys)(`%s`, (k) => {
        const key = k as keyof Config
        const value = getLegacyValue(key)

        expect(config[key].isDefault).toBe(true)
        expect(config[key].value).toStrictEqual(value)
      })
    })

    it('parses shortcut "True" value for ui.blocks.meta', () => {
      const config = parse(
        `ui:
   blocks:
     meta: True`,
        {},
      )
      expect(config['ui.blocks.meta'].value).toBe(true)
      expect(config['ui.blocks.meta.user_meta.expanded'].value).toBe(false)
      expect(config['ui.blocks.meta.workflows.expanded'].value).toBe(false)
    })

    it('parses full value for ui.blocks.meta', () => {
      const config = parse(
        `ui:
   blocks:
     meta:
       user_meta:
         expanded: True
       workflows:
         expanded: True`,
        {},
      )
      expect(config['ui.blocks.meta'].value).toBe(true)
      expect(config['ui.blocks.meta.user_meta.expanded'].value).toBe(true)
      expect(config['ui.blocks.meta.workflows.expanded'].value).toBe(true)
    })
  })
})
