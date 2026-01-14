import type { Json, JsonRecord } from 'utils/types'
import * as YAML from 'utils/yaml'
import type {
  BucketPreferencesInput,
  MetaBlockPreferencesInput,
} from 'utils/BucketPreferences'
import { validate } from 'utils/BucketPreferences'

type Key = keyof Defaults

export interface TypedValue<V extends KeyedValue['value']> {
  isDefault: boolean
  key: Key
  value: V
}

export type KeyedValue<K extends Key = Key> = TypedValue<NonNullable<Defaults[K]>>

function childOfBool<T>(parent: undefined | boolean | Record<string, T>, key: string) {
  return typeof parent === 'boolean' ? parent : parent?.[key]
}

function isExpanded(
  parent: undefined | boolean | MetaBlockPreferencesInput,
  key: keyof MetaBlockPreferencesInput,
) {
  if (typeof parent === 'boolean') return false
  return parent?.[key]?.expanded
}

function parseUser(config: string) {
  const json = YAML.parse(config) as BucketPreferencesInput
  return {
    'ui.actions.copyPackage': childOfBool(json?.ui?.actions, 'copyPackage'),
    'ui.actions.createPackage': childOfBool(json?.ui?.actions, 'createPackage'),
    'ui.actions.deleteObject': childOfBool(json?.ui?.actions, 'deleteObject'),
    'ui.actions.deleteRevision': childOfBool(json?.ui?.actions, 'deleteRevision'),
    'ui.actions.downloadObject': childOfBool(json?.ui?.actions, 'downloadObject'),
    'ui.actions.downloadPackage': childOfBool(json?.ui?.actions, 'downloadPackage'),
    'ui.actions.openInDesktop': childOfBool(json?.ui?.actions, 'openInDesktop'),
    'ui.actions.revisePackage': childOfBool(json?.ui?.actions, 'revisePackage'),
    'ui.actions.writeFile': childOfBool(json?.ui?.actions, 'writeFile'),

    'ui.blocks.analytics': json?.ui?.blocks?.analytics,
    'ui.blocks.browser': json?.ui?.blocks?.browser,
    'ui.blocks.code': json?.ui?.blocks?.code,

    'ui.blocks.meta':
      typeof json?.ui?.blocks?.meta !== 'undefined'
        ? !!json.ui.blocks.meta
        : json?.ui?.blocks?.meta,
    'ui.blocks.meta.user_meta.expanded': isExpanded(json?.ui?.blocks?.meta, 'user_meta'),
    'ui.blocks.meta.workflows.expanded': isExpanded(json?.ui?.blocks?.meta, 'workflows'),

    'ui.blocks.gallery.files': childOfBool(json?.ui?.blocks?.gallery, 'files'),
    'ui.blocks.gallery.overview': childOfBool(json?.ui?.blocks?.gallery, 'overview'),
    'ui.blocks.gallery.packages': childOfBool(json?.ui?.blocks?.gallery, 'packages'),
    'ui.blocks.gallery.summarize': childOfBool(json?.ui?.blocks?.gallery, 'summarize'),

    'ui.blocks.qurator': json?.ui?.blocks?.qurator,

    'ui.nav.files': childOfBool(json?.ui?.nav, 'files'),
    'ui.nav.workflows': childOfBool(json?.ui?.nav, 'workflows'),
    'ui.nav.packages': childOfBool(json?.ui?.nav, 'packages'),
    'ui.nav.queries': childOfBool(json?.ui?.nav, 'queries'),

    'ui.package_description': json?.ui?.package_description,
    'ui.package_description_multiline': json?.ui?.package_description_multiline,

    'ui.sourceBuckets': json?.ui?.sourceBuckets && Object.keys(json?.ui?.sourceBuckets),
    'ui.defaultSourceBucket': json?.ui?.defaultSourceBucket,

    'ui.athena.defaultWorkgroup': json?.ui?.athena?.defaultWorkgroup,
  }
}

type Defaults = Required<ReturnType<typeof parseUser>>

const sys: Defaults = {
  'ui.actions.copyPackage': true,
  'ui.actions.createPackage': true,
  'ui.actions.deleteObject': false,
  'ui.actions.deleteRevision': false,
  'ui.actions.downloadObject': true,
  'ui.actions.downloadPackage': true,
  'ui.actions.openInDesktop': true,
  'ui.actions.revisePackage': true,
  'ui.actions.writeFile': true,

  'ui.athena.defaultWorkgroup': '',

  'ui.blocks.analytics': true,
  'ui.blocks.browser': true,
  'ui.blocks.code': true,

  'ui.blocks.meta': true,
  'ui.blocks.meta.user_meta.expanded': false,
  'ui.blocks.meta.workflows.expanded': false,

  'ui.blocks.gallery.files': true,
  'ui.blocks.gallery.overview': true,
  'ui.blocks.gallery.packages': true,
  'ui.blocks.gallery.summarize': true,

  'ui.blocks.qurator': true,

  'ui.nav.files': true,
  'ui.nav.workflows': true,
  'ui.nav.packages': true,
  'ui.nav.queries': true,

  'ui.package_description': {
    '.*': {
      message: true as const,
      user_meta: [] as ReadonlyArray<string>,
    },
  },
  'ui.package_description_multiline': false,

  'ui.sourceBuckets': [],
  'ui.defaultSourceBucket': '',
}

function val<K extends Key>(
  key: K,
  user: Partial<Defaults>,
  ext: Partial<Defaults>,
): KeyedValue<K> {
  return {
    isDefault: typeof user[key] === 'undefined',
    key,
    value: (user[key] ?? ext[key] ?? sys[key]) as NonNullable<Defaults[K]>,
  }
}

// TODO: Replace utils/BucketPreferences with this implementation
export function parse(config: string, ext: Partial<Defaults>) {
  const user = parseUser(config)
  return {
    'ui.actions.copyPackage': val('ui.actions.copyPackage', user, ext),
    'ui.actions.createPackage': val('ui.actions.createPackage', user, ext),
    'ui.actions.deleteObject': val('ui.actions.deleteObject', user, ext),
    'ui.actions.deleteRevision': val('ui.actions.deleteRevision', user, ext),
    'ui.actions.downloadObject': val('ui.actions.downloadObject', user, ext),
    'ui.actions.downloadPackage': val('ui.actions.downloadPackage', user, ext),
    'ui.actions.openInDesktop': val('ui.actions.openInDesktop', user, ext),
    'ui.actions.revisePackage': val('ui.actions.revisePackage', user, ext),
    'ui.actions.writeFile': val('ui.actions.writeFile', user, ext),

    'ui.blocks.analytics': val('ui.blocks.analytics', user, ext),
    'ui.blocks.browser': val('ui.blocks.browser', user, ext),
    'ui.blocks.code': val('ui.blocks.code', user, ext),

    'ui.blocks.meta': val('ui.blocks.meta', user, ext),
    'ui.blocks.meta.user_meta.expanded': val(
      'ui.blocks.meta.user_meta.expanded',
      user,
      ext,
    ),
    'ui.blocks.meta.workflows.expanded': val(
      'ui.blocks.meta.workflows.expanded',
      user,
      ext,
    ),

    'ui.blocks.gallery.files': val('ui.blocks.gallery.files', user, ext),
    'ui.blocks.gallery.overview': val('ui.blocks.gallery.overview', user, ext),
    'ui.blocks.gallery.packages': val('ui.blocks.gallery.packages', user, ext),
    'ui.blocks.gallery.summarize': val('ui.blocks.gallery.summarize', user, ext),

    'ui.blocks.qurator': val('ui.blocks.qurator', user, ext),

    'ui.nav.files': val('ui.nav.files', user, ext),
    'ui.nav.workflows': val('ui.nav.workflows', user, ext),
    'ui.nav.packages': val('ui.nav.packages', user, ext),
    'ui.nav.queries': val('ui.nav.queries', user, ext),

    'ui.sourceBuckets': val('ui.sourceBuckets', user, ext),
    // TODO: on the next iteration of design, try to keep the `default` inside `sourceBuckets`,
    //       most likely, by tweaking `stringify` function
    'ui.defaultSourceBucket': val('ui.defaultSourceBucket', user, ext),

    'ui.package_description': val('ui.package_description', user, ext),
    // TODO: on the next iteration of design, try to keep the `multiline` inside `package_descrpition`
    'ui.package_description_multiline': val(
      'ui.package_description_multiline',
      user,
      ext,
    ),

    'ui.athena.defaultWorkgroup': val('ui.athena.defaultWorkgroup', user, ext),
  }
}

export type Config = ReturnType<typeof parse>

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

export function assocPath(obj: JsonRecord, value: Json, path: string[]): JsonRecord {
  const [head, ...parts] = path
  if (parts.length === 0) return { ...obj, [head]: value }
  const nested = obj[head]
  if (isJsonRecord(nested)) {
    return {
      ...obj,
      [head]: assocPath(nested, value, parts),
    }
  }
  return {
    ...obj,
    [head]: assocPath({}, value, parts),
  }
}

export function stringify(config: Config): string {
  const aux = Object.entries(config).reduce((memo, [key, value]) => {
    if (value.isDefault) return memo
    if (key === 'ui.sourceBuckets') {
      const sourceBuckets = (value.value as string[]).reduce(
        (acc: JsonRecord, bucket: string) => ({
          ...acc,
          [bucket]: {},
        }),
        {},
      )
      return assocPath(memo, sourceBuckets as Json, key.split('.'))
    }
    return assocPath(memo, value.value as Json, key.split('.'))
  }, {} as JsonRecord)
  validate(aux)
  return YAML.stringify(aux)
}
