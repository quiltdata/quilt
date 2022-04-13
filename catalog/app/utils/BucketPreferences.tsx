import * as R from 'ramda'
import * as React from 'react'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as Sentry from 'utils/Sentry'
import { makeSchemaValidator } from 'utils/json-schema'
import yaml from 'utils/yaml'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

type SentryInstance = (command: 'captureMessage', message: string) => void

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

interface BucketPreferences {
  ui: UiPreferences
}

const defaultPreferences: BucketPreferences = {
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

const localModePreferences: BucketPreferences = {
  ui: {
    ...defaultPreferences.ui,
    actions: {
      copyPackage: false,
      createPackage: false,
      deleteRevision: false,
      revisePackage: false,
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
      queries: false,
    },
  },
}

const bucketPreferencesValidator = makeSchemaValidator(bucketPreferencesSchema)

function validate(data: unknown): asserts data is BucketPreferencesYaml {
  const errors = bucketPreferencesValidator(data)
  if (errors.length) throw new bucketErrors.BucketPreferencesInvalid({ errors })
}

const S3_PREFIX = 's3://'
const normalizeBucketName = (input: string) =>
  input.startsWith(S3_PREFIX) ? input.slice(S3_PREFIX.length) : input

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

function parse(bucketPreferencesYaml: string, sentry: SentryInstance): BucketPreferences {
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

const BUCKET_PREFERENCES_PATH = [
  '.quilt/catalog/config.yaml',
  '.quilt/catalog/config.yml',
]

interface FetchBucketPreferencesArgs {
  s3: $TSFixMe
  bucket: string
  sentry: SentryInstance
  local: boolean
}

async function fetchBucketPreferences({
  s3,
  sentry,
  bucket,
  local,
}: FetchBucketPreferencesArgs) {
  if (local) return localModePreferences
  try {
    const response = await requests.fetchFile({
      s3,
      bucket,
      path: BUCKET_PREFERENCES_PATH,
    })
    return parse(response.Body.toString('utf-8'), sentry)
  } catch (e) {
    if (
      e instanceof bucketErrors.FileNotFound ||
      e instanceof bucketErrors.VersionNotFound
    )
      return defaultPreferences

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

const Ctx = React.createContext<BucketPreferences | null>(null)

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

export function Provider({ bucket, children }: ProviderProps) {
  const cfg = Config.use()
  const local = cfg.mode === 'LOCAL'
  const sentry = Sentry.use()
  const s3 = AWS.S3.use()
  const data = useData(fetchBucketPreferences, { s3, sentry, bucket, local })

  // XXX: consider returning AsyncResult or using Suspense
  const preferences = data.case({
    Ok: R.identity,
    Err: () => defaultPreferences,
    _: () => null,
  })
  return <Ctx.Provider value={preferences}>{children}</Ctx.Provider>
}

export const useBucketPreferences = () => React.useContext(Ctx)

export const use = useBucketPreferences
