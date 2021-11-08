import * as R from 'ramda'
import * as React from 'react'

import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'

import * as AWS from 'utils/AWS'
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

export type NavPreferences = Record<'files' | 'packages' | 'queries', boolean>

export interface SourceBuckets {
  getDefault: () => string
  list: string[]
}

interface UiPreferences {
  actions: ActionPreferences
  nav: NavPreferences
  sourceBuckets: SourceBuckets
}

interface UiPreferencesYaml {
  actions?: ActionPreferences
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
}

const fetchBucketPreferences = async ({
  s3,
  sentry,
  bucket,
}: FetchBucketPreferencesArgs) => {
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
  const sentry = Sentry.use()
  const s3 = AWS.S3.use()
  const data = useData(fetchBucketPreferences, { s3, sentry, bucket })

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
