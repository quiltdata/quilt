import * as R from 'ramda'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import * as bucketErrors from 'containers/Bucket/errors'
import { makeSchemaValidator } from 'utils/json-schema'
import yaml from 'utils/yaml'

export type SentryInstance = (command: 'captureMessage', message: string) => void

export type ActionPreferences = Record<
  'copyPackage' | 'createPackage' | 'deleteRevision' | 'revisePackage',
  boolean
>

export type BlocksPreferences = Record<'analytics' | 'browser' | 'code' | 'meta', boolean>

export type NavPreferences = Record<'files' | 'packages' | 'queries', boolean>

export interface SourceBuckets {
  getDefault: () => string
  list: string[]
}

interface UiPreferences {
  actions: ActionPreferences
  blocks: BlocksPreferences
  nav: NavPreferences
  sourceBuckets: SourceBuckets
}

interface UiPreferencesYaml {
  actions?: ActionPreferences
  blocks?: BlocksPreferences
  defaultSourceBucket?: string
  nav?: NavPreferences
  sourceBuckets?: Record<string, null>
}

interface BucketPreferencesYaml {
  ui?: UiPreferencesYaml
}

export interface BucketPreferences {
  ui: UiPreferences
}

export const defaultPreferences: BucketPreferences = {
  ui: {
    actions: {
      copyPackage: true,
      createPackage: true,
      deleteRevision: false,
      revisePackage: true,
    },
    blocks: {
      analytics: true,
      browser: true,
      code: true,
      meta: true,
    },
    nav: {
      files: true,
      packages: true,
      queries: true,
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

function validate(data: unknown): asserts data is BucketPreferencesYaml {
  const errors = bucketPreferencesValidator(data)
  if (errors.length) throw new bucketErrors.BucketPreferencesInvalid({ errors })
}

function parseSourceBuckets(
  sentry: SentryInstance,
  ui?: UiPreferencesYaml,
): SourceBuckets {
  const list = Object.keys(ui?.sourceBuckets || {}).map(normalizeBucketName)
  const defaultSourceBucket = normalizeBucketName(ui?.defaultSourceBucket || '')
  return {
    getDefault: () => {
      if (defaultSourceBucket) {
        const found = list.find((name) => name === defaultSourceBucket)
        if (found) return found
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

export function parse(
  bucketPreferencesYaml: string,
  sentry: SentryInstance,
): BucketPreferences {
  const data = yaml(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return {
    ui: {
      actions: R.mergeRight(defaultPreferences.ui.actions, data?.ui?.actions || {}),
      blocks: R.mergeRight(defaultPreferences.ui.blocks, data?.ui?.blocks || {}),
      nav: R.mergeRight(defaultPreferences.ui.nav, data?.ui?.nav || {}),
      sourceBuckets: parseSourceBuckets(sentry, data?.ui),
    },
  }
}
