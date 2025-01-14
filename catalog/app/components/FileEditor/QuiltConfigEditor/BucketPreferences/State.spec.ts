import * as legacyBucketPreferences from 'utils/BucketPreferences/BucketPreferences'
import type { PackagePreferencesInput } from 'utils/BucketPreferences/BucketPreferences'

import { assocPath, parse, stringify } from './State'
import type { Config } from './State'

jest.mock(
  'constants/config',
  jest.fn(() => ({})),
)

function getValueByPath(obj: Record<string, any>, path: string[]) {
  return path.reduce((memo, key) => memo[key], obj)
}

const legacyPrefs = legacyBucketPreferences.parse('')
function getLegacyValue(key: keyof Config) {
  switch (key) {
    case 'ui.athena.defaultWorkgroup':
      // In the legacy implementation it is `undefined`
      return ''
    case 'ui.blocks.meta.user_meta.expanded':
      return getValueByPath(legacyPrefs, 'ui.blocks.meta.userMeta.expanded'.split('.'))
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
    case 'ui.package_description_multiline':
      return legacyPrefs.ui.packageDescription.userMetaMultiline
    case 'ui.source_buckets':
      return legacyPrefs.ui.sourceBuckets.list
    case 'ui.source_buckets.default':
      return legacyPrefs.ui.sourceBuckets.getDefault()
    default:
      return getValueByPath(legacyPrefs, key.split('.'))
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
      expect(stringify(config)).toBe(`ui:
  nav:
    files: true
`)
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

  describe('assocPath', () => {
    it('makes a shallow clone of an object, overriding only what is necessary for the path', () => {
      const obj1 = {
        a: { b: 1, c: 2, d: { e: 3 } },
        f: { g: { h: 4, i: { x: 5, y: 6, z: 7 }, j: { k: 6, l: 7 } } },
        m: 8,
      }
      const obj2 = assocPath(obj1, 42, ['f', 'g', 'i', 'y'])
      // @ts-expect-error
      expect(obj2.f.g.i).toStrictEqual({ x: 5, y: 42, z: 7 })
      expect(obj2.a).toBe(obj1.a)
      expect(obj2.m).toBe(obj1.m)
      // @ts-expect-error
      expect(obj2.f.g.h).toBe(obj1.f.g.h)
      // @ts-expect-error
      expect(obj2.f.g.j).toBe(obj1.f.g.j)
    })

    it('is the equivalent of clone and setPath if the property is not on the original', () => {
      const obj1 = { a: 1, b: { c: 2, d: 3 }, e: 4, f: 5 }
      const obj2 = assocPath(obj1, 42, ['x', 'y'])
      expect(obj2).toStrictEqual({
        a: 1,
        b: { c: 2, d: 3 },
        e: 4,
        f: 5,
        x: { y: 42 },
      })
      expect(obj2.a).toBe(obj1.a)
      expect(obj2.b).toBe(obj1.b)
      expect(obj2.e).toBe(obj1.e)
      expect(obj2.f).toBe(obj1.f)
    })

    it('overwrites primitive values with keys in the path', () => {
      const obj1 = { a: 'str' }
      const obj2 = assocPath(obj1, 42, ['a', 'b'])
      expect(obj2.a).toStrictEqual({ b: 42 })
    })

    it('replaces `null` with a new object', () => {
      expect(assocPath({ foo: null }, 42, ['foo', 'bar', 'baz'])).toStrictEqual({
        foo: { bar: { baz: 42 } },
      })
    })
  })
})
