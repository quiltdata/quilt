import type { ErrorObject } from 'ajv'
import * as R from 'ramda'
import * as Sentry from '@sentry/react'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import { makeSchemaValidator } from 'utils/JSONSchema'
import { JsonInvalidAgainstSchema } from 'utils/error'
import * as s3paths from 'utils/s3paths'
import * as tagged from 'utils/taggedV2'
import type { JsonRecord } from 'utils/types'
import * as YAML from 'utils/yaml'

export type ActionPreferences = Record<
  | 'copyPackage'
  | 'createPackage'
  | 'deleteRevision'
  | 'downloadObject'
  | 'downloadPackage'
  | 'openInDesktop'
  | 'revisePackage'
  | 'writeFile',
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

type GalleryPreferences = Record<'files' | 'packages' | 'overview' | 'summarize', boolean>

interface BlocksPreferencesInput {
  analytics?: boolean
  browser?: boolean
  code?: boolean
  meta?: boolean | MetaBlockPreferencesInput
  gallery?: boolean | GalleryPreferences
  qurator?: boolean
}

interface BlocksPreferences {
  analytics: boolean
  browser: boolean
  code: boolean
  meta: false | MetaBlockPreferences
  gallery: false | GalleryPreferences
  qurator: boolean
}

export type NavPreferences = Record<
  'files' | 'packages' | 'workflows' | 'queries',
  boolean
>

export interface PackagePreferencesInput {
  message?: boolean
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
type SourceBucketsInput = Record<string, {}>

interface AthenaPreferencesInput {
  defaultWorkflow?: string // @deprecated, was used by mistake
  defaultWorkgroup?: string
}

export interface AthenaPreferences {
  defaultWorkgroup?: string
}

interface UiPreferencesInput {
  actions?: Partial<ActionPreferences> | false
  athena?: AthenaPreferences
  blocks?: Partial<BlocksPreferencesInput>
  defaultSourceBucket?: DefaultSourceBucketInput
  nav?: Partial<NavPreferences>
  package_description?: PackagesListPreferencesInput
  package_description_multiline?: PackageDescriptionMultiline
  sourceBuckets?: SourceBucketsInput
}

export interface BucketPreferencesInput {
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

export interface BucketPreferences {
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
      meta: defaultBlockMeta,
      gallery: defaultGallery,
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
      getDefault: () => '',
      list: [],
    },
  },
}

const S3_PREFIX = 's3://'
const removeS3Prefix = (input: string) => s3paths.withoutPrefix(S3_PREFIX, input)

const bucketPreferencesValidator = makeSchemaValidator(bucketPreferencesSchema)

export function validate(data: unknown): asserts data is BucketPreferencesInput {
  const obj = typeof data === 'string' ? YAML.parse(data) : data
  const errors = bucketPreferencesValidator(obj)
  if (errors.length) {
    if (errors[0] instanceof Error) throw errors
    throw new JsonInvalidAgainstSchema({ errors: errors as ErrorObject[] })
  }
}

function parseActions(actions?: Partial<ActionPreferences> | false): ActionPreferences {
  if (actions === false) {
    return R.map(R.F, defaultPreferences.ui.actions)
  }

  return {
    ...defaultPreferences.ui.actions,
    ...actions,
  }
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
    overview: gallery.overview ?? defaultGallery.overview,
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

function getSourceBucketsList(
  sourceBuckets?: SourceBucketsInput,
  bucket?: string,
): string[] {
  if (sourceBuckets) return Object.keys(sourceBuckets).map(removeS3Prefix)
  if (bucket) return [bucket]
  // Only in 'local' mode
  // TODO: Consider to throw error when cfg.mode !== 'LOCAL'
  return []
}

function parseSourceBuckets(
  sourceBuckets?: SourceBucketsInput,
  defaultSourceBucketInput?: DefaultSourceBucketInput,
  bucket?: string,
): SourceBuckets {
  const list = getSourceBucketsList(sourceBuckets, bucket)
  const defaultSourceBucket = removeS3Prefix(defaultSourceBucketInput || '')
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

export function extendDefaults(
  data: BucketPreferencesInput,
  bucket?: string,
): BucketPreferences {
  return {
    ui: {
      ...R.mergeDeepRight(defaultPreferences.ui, data?.ui || {}),
      actions: parseActions(data?.ui?.actions),
      athena: parseAthena(data?.ui?.athena),
      blocks: parseBlocks(data?.ui?.blocks),
      packageDescription: parsePackages(
        data?.ui?.package_description,
        data?.ui?.package_description_multiline,
      ),
      sourceBuckets: parseSourceBuckets(
        data?.ui?.sourceBuckets,
        data?.ui?.defaultSourceBucket,
        bucket,
      ),
    },
  }
}

export function parse(bucketPreferencesYaml: string, bucket: string): BucketPreferences {
  const data = YAML.parse(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return extendDefaults(data, bucket)
}

export const Result = tagged.create('app/utils/BucketPreferences:Result' as const, {
  // TODO: Error: (e: Error) => e,
  Ok: (prefs: BucketPreferences) => prefs,
  Pending: () => null,
  Init: () => null,
})

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Result = tagged.InstanceOf<typeof Result>

export function merge(bucketPreferencesYaml: string, update: BucketPreferencesInput) {
  try {
    const prefs = YAML.parse(bucketPreferencesYaml) as JsonRecord
    return YAML.stringify(R.mergeDeepRight(prefs, update))
  } catch (e) {
    return YAML.stringify(update as JsonRecord)
  }
}

export const sourceBucket = (bucket: string): BucketPreferencesInput => ({
  ui: {
    sourceBuckets: {
      [bucket]: {},
    },
  },
})
