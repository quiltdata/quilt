import * as R from 'ramda'
import * as Sentry from '@sentry/react'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import * as bucketErrors from 'containers/Bucket/errors'
import { makeSchemaValidator } from 'utils/json-schema'
import * as tagged from 'utils/taggedV2'
import * as YAML from 'utils/yaml'

export type ActionPreferences = Record<
  'copyPackage' | 'createPackage' | 'deleteRevision' | 'openInDesktop' | 'revisePackage',
  boolean
>

export interface MetaBlockPreferencesInput {
  user_meta?: {
    expanded: boolean | number
  }
  workflows?: {
    expanded: boolean | number
  }
}

export interface MetaBlockPreferences {
  userMeta: {
    expanded: boolean | number
  }
  workflows: {
    expanded: boolean | number
  }
}

export type GalleryPreferences = Record<
  'files' | 'packages' | 'overview' | 'summarize',
  boolean
>

interface BlocksPreferencesInput {
  analytics?: boolean
  browser?: boolean
  code?: boolean
  meta?: boolean | MetaBlockPreferencesInput
  gallery?: boolean | GalleryPreferences
}

interface BlocksPreferences {
  analytics: boolean
  browser: boolean
  code: boolean
  meta: false | MetaBlockPreferences
  gallery: false | GalleryPreferences
}

export type NavPreferences = Record<'files' | 'packages' | 'queries', boolean>

interface PackagePreferencesInput {
  message?: true
  user_meta?: ReadonlyArray<string>
}
export interface PackagePreferences {
  message?: true
  userMeta?: ReadonlyArray<string>
}
type PackagesListPreferencesInput = Record<string, PackagePreferencesInput>
interface PackagesListPreferences {
  packages: Record<string, PackagePreferences>
  userMetaMultiline: boolean
}

type DefaultSourceBucketInput = string
type PackageDescriptionMultiline = boolean
type SourceBucketsInput = Record<string, null>

export interface AthenaPreferencesInput {
  defaultWorkflow?: string // @deprecated, was used by mistake
  defaultWorkgroup?: string
}

export interface AthenaPreferences {
  defaultWorkgroup?: string
}

interface UiPreferencesInput {
  actions?: Partial<ActionPreferences>
  athena?: AthenaPreferences
  blocks?: Partial<BlocksPreferencesInput>
  defaultSourceBucket?: DefaultSourceBucketInput
  nav?: Partial<NavPreferences>
  package_description?: PackagesListPreferencesInput
  package_description_multiline?: PackageDescriptionMultiline
  sourceBuckets?: SourceBucketsInput
}

interface BucketPreferencesInput {
  ui?: UiPreferencesInput
}

export interface SourceBuckets {
  getDefault: () => string
  list: string[]
}

interface UiPreferences {
  actions: ActionPreferences
  athena: AthenaPreferences
  blocks: BlocksPreferences
  nav: NavPreferences
  packageDescription: PackagesListPreferences
  sourceBuckets: SourceBuckets
}

interface BucketPreferences {
  ui: UiPreferences
}

const defaultBlockMeta: MetaBlockPreferences = {
  userMeta: {
    expanded: false,
  },
  workflows: {
    expanded: false,
  },
}

const defaultGallery: GalleryPreferences = {
  files: true,
  overview: true,
  packages: true,
  summarize: true,
}

const defaultPreferences: BucketPreferences = {
  ui: {
    actions: {
      copyPackage: true,
      createPackage: true,
      deleteRevision: false,
      openInDesktop: false,
      revisePackage: true,
    },
    athena: {},
    blocks: {
      analytics: true,
      browser: true,
      code: true,
      meta: defaultBlockMeta,
      gallery: defaultGallery,
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
      getDefault: () => '',
      list: [],
    },
  },
}

const S3_PREFIX = 's3://'
const normalizeBucketName = (input: string) =>
  input.startsWith(S3_PREFIX) ? input.slice(S3_PREFIX.length) : input

const bucketPreferencesValidator = makeSchemaValidator(bucketPreferencesSchema)

function validate(data: unknown): asserts data is BucketPreferencesInput {
  const errors = bucketPreferencesValidator(data)
  if (errors.length) throw new bucketErrors.BucketPreferencesInvalid({ errors })
}

function parseAthena(athena?: AthenaPreferencesInput): AthenaPreferences {
  const { defaultWorkflow, ...rest } = { ...defaultPreferences.ui.athena, ...athena }
  return {
    ...(defaultWorkflow
      ? {
          defaultWorkgroup: defaultWorkflow,
        }
      : null),
    ...rest,
  }
}

function parseGalleryBlock(
  gallery?: boolean | GalleryPreferences,
): false | GalleryPreferences {
  if (gallery === false) return false
  if (gallery === true || gallery === undefined) return defaultGallery
  return {
    files: gallery.files ?? defaultGallery.files,
    packages: gallery.packages ?? defaultGallery.packages,
    overview: gallery.packages ?? defaultGallery.overview,
    summarize: gallery.summarize ?? defaultGallery.summarize,
  }
}

function parseMetaBlock(
  meta?: boolean | MetaBlockPreferencesInput,
): false | MetaBlockPreferences {
  if (meta === false) return false
  if (meta === true || meta === undefined) return defaultBlockMeta
  return {
    userMeta: meta.user_meta || defaultBlockMeta.userMeta,
    workflows: meta.workflows || defaultBlockMeta.workflows,
  }
}

function parseBlocks(blocks?: BlocksPreferencesInput): BlocksPreferences {
  return {
    ...defaultPreferences.ui.blocks,
    ...blocks,
    meta: parseMetaBlock(blocks?.meta),
    gallery: parseGalleryBlock(blocks?.gallery),
  }
}

function parsePackages(
  packages?: PackagesListPreferencesInput,
  userMetaMultiline: boolean = false,
): PackagesListPreferences {
  return Object.entries(packages || {}).reduce(
    (memo, [name, { message, user_meta }]) =>
      R.assocPath(
        ['packages', name],
        {
          message,
          userMeta: user_meta,
        },
        memo,
      ),
    {
      packages: defaultPreferences.ui.packageDescription.packages,
      userMetaMultiline:
        userMetaMultiline || defaultPreferences.ui.packageDescription.userMetaMultiline,
    },
  )
}

function parseSourceBuckets(
  sourceBuckets?: SourceBucketsInput,
  defaultSourceBucketInput?: DefaultSourceBucketInput,
): SourceBuckets {
  const list = Object.keys(sourceBuckets || {}).map(normalizeBucketName)
  const defaultSourceBucket = normalizeBucketName(defaultSourceBucketInput || '')
  return {
    getDefault: () => {
      if (defaultSourceBucket) {
        const found = list.find((name) => name === defaultSourceBucket)
        if (found) return found
        // TODO: use more civilized logger, log all similar configuration errors
        Sentry.captureMessage(`defaultSourceBucket ${defaultSourceBucket} is incorrect`)
      }
      return list[0] || ''
    },
    list,
  }
}

export function extendDefaults(data: BucketPreferencesInput): BucketPreferences {
  return {
    ui: {
      ...R.mergeDeepRight(defaultPreferences.ui, data?.ui || {}),
      athena: parseAthena(data?.ui?.athena),
      blocks: parseBlocks(data?.ui?.blocks),
      packageDescription: parsePackages(
        data?.ui?.package_description,
        data?.ui?.package_description_multiline,
      ),
      sourceBuckets: parseSourceBuckets(
        data?.ui?.sourceBuckets,
        data?.ui?.defaultSourceBucket,
      ),
    },
  }
}

export function parse(bucketPreferencesYaml: string): BucketPreferences {
  const data = YAML.parse(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return extendDefaults(data)
}

export const Result = tagged.create('app/utils/BucketPreferences:Result' as const, {
  // TODO: Error: (e: Error) => e,
  Ok: (prefs: BucketPreferences) => prefs,
  Pending: () => null,
  Init: () => null,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Result = tagged.InstanceOf<typeof Result>
