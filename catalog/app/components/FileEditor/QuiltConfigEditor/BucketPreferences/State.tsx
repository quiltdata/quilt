import type { Json, JsonRecord } from 'utils/types'
import * as YAML from 'utils/yaml'
import type {
  BucketPreferencesInput,
  MetaBlockPreferencesInput,
} from 'utils/BucketPreferences'

export interface Value<K extends keyof Defaults = keyof Defaults> {
  isDefault: boolean
  key: K
  value: NonNullable<Defaults[K]>
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

function val<K extends keyof Defaults>(
  key: K,
  user: Partial<Defaults>,
  sys: Defaults,
  ext: Partial<Defaults>,
): Value<K> {
  return {
    isDefault: !user[key],
    key,
    value: (user[key] ?? ext[key] ?? sys[key]) as NonNullable<Defaults[K]>,
  }
}

export function parse(config: string, sys: Defaults, ext: Partial<Defaults>) {
  const user = parseUser(config)
  return {
    'ui.actions.copyPackage': val('ui.actions.copyPackage', user, sys, ext),
    'ui.actions.createPackage': val('ui.actions.createPackage', user, sys, ext),
    'ui.actions.deleteRevision': val('ui.actions.deleteRevision', user, sys, ext),
    'ui.actions.revisePackage': val('ui.actions.revisePackage', user, sys, ext),

    'ui.blocks.analytics': val('ui.blocks.analytics', user, sys, ext),
    'ui.blocks.browser': val('ui.blocks.browser', user, sys, ext),
    'ui.blocks.code': val('ui.blocks.code', user, sys, ext),

    'ui.blocks.meta': val('ui.blocks.meta', user, sys, ext),
    'ui.blocks.meta.user_meta.expanded': val(
      'ui.blocks.meta.user_meta.expanded',
      user,
      sys,
      ext,
    ),
    'ui.blocks.meta.workflows.expanded': val(
      'ui.blocks.meta.workflows.expanded',
      user,
      sys,
      ext,
    ),

    'ui.blocks.gallery.files': val('ui.blocks.gallery.files', user, sys, ext),
    'ui.blocks.gallery.overview': val('ui.blocks.gallery.overview', user, sys, ext),
    'ui.blocks.gallery.packages': val('ui.blocks.gallery.packages', user, sys, ext),
    'ui.blocks.gallery.summarize': val('ui.blocks.gallery.summarize', user, sys, ext),

    'ui.blocks.qurator': val('ui.blocks.qurator', user, sys, ext),

    'ui.nav.files': val('ui.nav.files', user, sys, ext),
    'ui.nav.packages': val('ui.nav.packages', user, sys, ext),
    'ui.nav.queries': val('ui.nav.queries', user, sys, ext),

    'ui.source_buckets': val('ui.source_buckets', user, sys, ext),
    'ui.source_buckets.default': val('ui.source_buckets.default', user, sys, ext),

    'ui.package_description': val('ui.package_description', user, sys, ext),
    'ui.package_description.multiline': val(
      'ui.package_description.multiline',
      user,
      sys,
      ext,
    ),

    'ui.athena.defaultWorkgroup': val('ui.athena.defaultWorkgroup', user, sys, ext),
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
