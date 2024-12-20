import type { Json, JsonRecord } from 'utils/types'
import * as YAML from 'utils/yaml'
import type {
  BucketPreferencesInput,
  MetaBlockPreferencesInput,
} from 'utils/BucketPreferences'

type Key = keyof Defaults

export interface Value<K extends Key = Key> {
  isDefault: boolean
  key: K
  value: NonNullable<Defaults[K]>
}

export interface TypedValue<V extends Value['value']> {
  isDefault: boolean
  key: Key
  value: V
}

function childOfBool<T>(parent: undefined | boolean | Record<string, T>, key: string) {
  return typeof parent === 'boolean' ? parent : parent?.[key]
}

function isExpanded(
  parent: undefined | boolean | MetaBlockPreferencesInput,
  key: keyof MetaBlockPreferencesInput,
) {
  if (parent === false) return false
  if (parent === true || parent === undefined) return false
  return parent[key]?.expanded
}

function parseUser(config: string) {
  const json = YAML.parse(config) as BucketPreferencesInput
  return {
    'ui.actions.copyPackage': childOfBool(json?.ui?.actions, 'copyPackage'),
    'ui.actions.createPackage': childOfBool(json?.ui?.actions, 'createPackage'),
    'ui.actions.deleteRevision': childOfBool(json?.ui?.actions, 'deleteRevision'),
    'ui.actions.revisePackage': childOfBool(json?.ui?.actions, 'revisePackage'),

    'ui.blocks.analytics': json?.ui?.blocks?.analytics,
    'ui.blocks.browser': json?.ui?.blocks?.browser,
    'ui.blocks.code': json?.ui?.blocks?.code,

    'ui.blocks.meta':
      typeof json?.ui?.blocks?.meta !== 'undefined'
        ? !!json?.ui?.blocks?.meta
        : json?.ui?.blocks?.meta,
    'ui.blocks.meta.user_meta.expanded': isExpanded(json?.ui?.blocks?.meta, 'user_meta'),
    'ui.blocks.meta.workflows.expanded': isExpanded(json?.ui?.blocks?.meta, 'workflows'),

    'ui.blocks.gallery.files': childOfBool(json?.ui?.blocks?.gallery, 'files'),
    'ui.blocks.gallery.overview': childOfBool(json?.ui?.blocks?.gallery, 'overview'),
    'ui.blocks.gallery.packages': childOfBool(json?.ui?.blocks?.gallery, 'packages'),
    'ui.blocks.gallery.summarize': childOfBool(json?.ui?.blocks?.gallery, 'summarize'),

    'ui.blocks.qurator': json?.ui?.blocks?.qurator,

    'ui.nav.files': childOfBool(json?.ui?.nav, 'files'),
    'ui.nav.packages': childOfBool(json?.ui?.nav, 'packages'),
    'ui.nav.queries': childOfBool(json?.ui?.nav, 'queries'),

    'ui.package_description': json?.ui?.package_description,
    'ui.package_description.multiline': json?.ui?.package_description_multiline,

    'ui.source_buckets': json?.ui?.sourceBuckets && Object.keys(json?.ui?.sourceBuckets),
    // TODO: taking the first from `source_buckets` is "system default"
    'ui.source_buckets.default': json?.ui?.defaultSourceBucket,

    'ui.athena.defaultWorkgroup': json?.ui?.athena?.defaultWorkgroup,
  }
}

type Defaults = Required<ReturnType<typeof parseUser>>

const sys: Defaults = {
  'ui.actions.copyPackage': true,
  'ui.actions.createPackage': true,
  'ui.actions.deleteRevision': false,
  'ui.actions.revisePackage': true,

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
  'ui.nav.packages': true,
  'ui.nav.queries': true,

  'ui.package_description': {
    '.*': {
      message: true as const,
      user_meta: [] as ReadonlyArray<string>,
    },
  },
  'ui.package_description.multiline': false,

  'ui.source_buckets': [],
  'ui.source_buckets.default': '',
}

function val<K extends Key>(
  key: K,
  user: Partial<Defaults>,
  ext: Partial<Defaults>,
): Value<K> {
  return {
    isDefault: !user[key],
    key,
    value: (user[key] ?? ext[key] ?? sys[key]) as NonNullable<Defaults[K]>,
  }
}

export function parse(config: string, ext: Partial<Defaults>) {
  const user = parseUser(config)
  return {
    'ui.actions.copyPackage': val('ui.actions.copyPackage', user, ext),
    'ui.actions.createPackage': val('ui.actions.createPackage', user, ext),
    'ui.actions.deleteRevision': val('ui.actions.deleteRevision', user, ext),
    'ui.actions.revisePackage': val('ui.actions.revisePackage', user, ext),

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
    'ui.nav.packages': val('ui.nav.packages', user, ext),
    'ui.nav.queries': val('ui.nav.queries', user, ext),

    'ui.source_buckets': val('ui.source_buckets', user, ext),
    'ui.source_buckets.default': val('ui.source_buckets.default', user, ext),

    'ui.package_description': val('ui.package_description', user, ext),
    'ui.package_description.multiline': val(
      'ui.package_description.multiline',
      user,
      ext,
    ),

    'ui.athena.defaultWorkgroup': val('ui.athena.defaultWorkgroup', user, ext),
  }
}

export type Config = ReturnType<typeof parse>

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

function assocPath(obj: JsonRecord, value: Json, path: string[]): JsonRecord {
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
  const aux = Object.entries(config).reduce(
    (memo, [key, value]) =>
      value.isDefault ? memo : assocPath(memo, value.value as Json, key.split('.')),
    {},
  )
  return JSON.stringify(aux)
}
