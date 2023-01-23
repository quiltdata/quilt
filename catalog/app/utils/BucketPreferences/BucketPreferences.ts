import * as R from 'ramda'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import * as bucketErrors from 'containers/Bucket/errors'
import { makeSchemaValidator } from 'utils/json-schema'
import * as YAML from 'utils/yaml'

export type SentryInstance = (command: 'captureMessage', message: string) => void

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

interface BlocksPreferencesInput {
  analytics?: boolean
  browser?: boolean
  code?: boolean
  meta?: boolean | MetaBlockPreferencesInput
}

interface BlocksPreferences {
  analytics: boolean
  browser: boolean
  code: boolean
  meta: false | MetaBlockPreferences
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
type PackagesListPreferences = Record<string, PackagePreferences>

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
  packageDescriptionMultiline: boolean
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
    },
    nav: {
      files: true,
      packages: true,
      queries: true,
    },
    packageDescription: {
      '.*': {
        message: true,
      },
    },
    packageDescriptionMultiline: false,
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
  }
}

function parsePackages(packages?: PackagesListPreferencesInput): PackagesListPreferences {
  return Object.entries(packages || {}).reduce(
    (memo, [name, { message, user_meta }]) => ({
      ...memo,
      [name]: {
        message,
        userMeta: user_meta,
      },
    }),
    defaultPreferences.ui.packageDescription,
  )
}

function parseSourceBuckets(
  sentry: SentryInstance,
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
        sentry(
          'captureMessage',
          `defaultSourceBucket ${defaultSourceBucket} is incorrect`,
        )
      }
      return list[0] || ''
    },
    list,
  }
}

export function extendDefaults(
  data: BucketPreferencesInput,
  sentry: SentryInstance,
): BucketPreferences {
  return {
    ui: {
      ...R.mergeDeepRight(defaultPreferences.ui, data?.ui || {}),
      athena: parseAthena(data?.ui?.athena),
      blocks: parseBlocks(data?.ui?.blocks),
      packageDescription: parsePackages(data?.ui?.package_description),
      packageDescriptionMultiline: !!data?.ui?.package_description_multiline,
      sourceBuckets: parseSourceBuckets(
        sentry,
        data?.ui?.sourceBuckets,
        data?.ui?.defaultSourceBucket,
      ),
    },
  }
}

export function parse(
  bucketPreferencesYaml: string,
  sentry: SentryInstance,
): BucketPreferences {
  const data = YAML.parse(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return extendDefaults(data, sentry)
}
