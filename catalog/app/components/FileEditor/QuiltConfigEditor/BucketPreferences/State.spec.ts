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

const legacyPrefs = legacyBucketPreferences.parse('', 'test-bucket')
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
    case 'ui.sourceBuckets':
      return legacyPrefs.ui.sourceBuckets.list
    case 'ui.defaultSourceBucket':
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

    it('should not overwrite context default values', () => {
      const config = parse('', {
        'ui.actions.createPackage': false,
        'ui.athena.defaultWorkgroup': 'Lorem ipsum',
      })
      expect(stringify(config)).toBe(``)
    })

    it('should keep unmodified user values', () => {
      const userConfig = `ui:
  actions:
    createPackage: false
  athena:
    defaultWorkgroup: Foo bar
`
      const config = parse(userConfig, {
        'ui.athena.defaultWorkgroup': 'Lorem ipsum',
      })
      expect(stringify(config)).toBe(userConfig)
    })

    it('should rewrite user values', () => {
      const config = parse(
        `ui:
  athena:
    defaultWorkgroup: Foo
`,
        {
          'ui.athena.defaultWorkgroup': 'Lorem ipsum',
        },
      )
      config['ui.athena.defaultWorkgroup'] = {
        isDefault: false,
        key: 'ui.athena.defaultWorkgroup',
        value: 'Bar',
      }
      expect(stringify(config)).toBe(`ui:
  athena:
    defaultWorkgroup: Bar
`)
    })

    it('should stringify source buckets', () => {
      const config = parse('', {})
      config['ui.sourceBuckets'] = {
        isDefault: false,
        key: 'ui.nav.files',
        value: ['s3://a', 's3://b'],
      }
      expect(stringify(config)).toBe(`ui:
  sourceBuckets:
    s3://a: {}
    s3://b: {}
`)
    })

    it('should stringify every custom field', () => {
      const userConfig = `ui:
  actions:
    copyPackage: false
    createPackage: false
    deleteRevision: true
    downloadObject: false
    downloadPackage: false
    openInDesktop: true
    revisePackage: false
    writeFile: false
  blocks:
    analytics: false
    browser: false
    code: false
    meta:
      user_meta:
        expanded: 2
      workflows:
        expanded: 3
    gallery:
      files: false
      overview: false
      packages: false
      summarize: false
    qurator: false
  nav:
    files: false
    workflows: false
    packages: false
    queries: false
  sourceBuckets:
    s3://a: {}
    s3://b: {}
    s3://c: {}
  defaultSourceBucket: s3://b
  package_description:
    ^prefix/namespace$:
      message: false
      user_meta:
        - $.Some.Key
        - $.Another.Key
  package_description_multiline: true
  athena:
    defaultWorkgroup: Foo
`
      const config = parse(userConfig, {})
      expect(stringify(config)).toBe(userConfig)
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

    it('should parse source buckets', () => {
      const config = parse(
        `ui:
   sourceBuckets:
     s3://a: {}
     s3://b: {}
      `,
        {},
      )
      expect(config['ui.sourceBuckets'].value).toStrictEqual(['s3://a', 's3://b'])
    })

    it('should parse every custom field', () => {
      const config = parse(
        `ui:
  actions:
    copyPackage: false
    createPackage: false
    deleteRevision: true
    downloadObject: false
    downloadPackage: false
    revisePackage: false
    writeFile: false
    openInDesktop: true
  blocks:
    analytics: false
    browser: false
    code: false
    meta:
      user_meta:
        expanded: 2
      workflows:
        expanded: 3
    gallery:
      files: false
      overview: false
      packages: false
      summarize: false
    qurator: false
  nav:
    files: false
    workflows: false
    packages: false
    queries: false
  sourceBuckets:
    s3://a: {}
    s3://b: {}
    s3://c: {}
  defaultSourceBucket: s3://b
  package_description:
    ^prefix/namespace$:
      message: false
      user_meta:
        - $.Some.Key
        - $.Another.Key
  package_description_multiline: true
  athena:
    defaultWorkgroup: Foo
`,
        {},
      )
      expect(
        Object.entries(config).reduce(
          (memo, [key, value]) => ({
            ...memo,
            [key]: value.value,
          }),
          {},
        ),
      ).toStrictEqual({
        'ui.actions.copyPackage': false,
        'ui.actions.createPackage': false,
        'ui.actions.deleteRevision': true,
        'ui.actions.downloadObject': false,
        'ui.actions.downloadPackage': false,
        'ui.actions.openInDesktop': true,
        'ui.actions.revisePackage': false,
        'ui.actions.writeFile': false,

        'ui.athena.defaultWorkgroup': 'Foo',

        'ui.blocks.analytics': false,
        'ui.blocks.browser': false,
        'ui.blocks.code': false,

        'ui.blocks.meta': true,
        'ui.blocks.meta.user_meta.expanded': 2,
        'ui.blocks.meta.workflows.expanded': 3,

        'ui.blocks.gallery.files': false,
        'ui.blocks.gallery.overview': false,
        'ui.blocks.gallery.packages': false,
        'ui.blocks.gallery.summarize': false,

        'ui.blocks.qurator': false,

        'ui.nav.files': false,
        'ui.nav.workflows': false,
        'ui.nav.packages': false,
        'ui.nav.queries': false,

        'ui.package_description': {
          '^prefix/namespace$': {
            message: false,
            user_meta: ['$.Some.Key', '$.Another.Key'],
          },
        },
        'ui.package_description_multiline': true,

        'ui.sourceBuckets': ['s3://a', 's3://b', 's3://c'],
        'ui.defaultSourceBucket': 's3://b',
      })
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
