import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import { makeSchemaValidator } from 'utils/json-schema'
import yaml from 'utils/yaml'
import bucketPreferencesSchema from 'schemas/bucketConfig.yml.json'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

export type ActionPreferences = Record<
  'copyPackage' | 'createPackage' | 'revisePackage',
  boolean
>

export type NavPreferences = Record<'files' | 'packages' | 'queries', boolean>

interface UiPreferences {
  actions: ActionPreferences
  nav: NavPreferences
  sourceBuckets: string[]
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
      revisePackage: true,
    },
    nav: {
      files: true,
      packages: true,
      queries: true,
    },
    sourceBuckets: [],
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

function parseSourceBuckets(ui?: UiPreferencesYaml): string[] {
  if (!ui?.sourceBuckets) return []
  return Object.keys(ui?.sourceBuckets)
    .sort((nameA, nameB) => {
      if (nameA === ui.defaultSourceBucket) return -1
      if (nameB === ui.defaultSourceBucket) return 1
      return 0
    })
    .map(normalizeBucketName)
}

function parse(bucketPreferencesYaml: string): BucketPreferences {
  const data = yaml(bucketPreferencesYaml)
  if (!data) return defaultPreferences

  validate(data)

  return {
    ui: {
      actions: R.mergeRight(defaultPreferences.ui.actions, data?.ui?.actions || {}),
      nav: R.mergeRight(defaultPreferences.ui.nav, data?.ui?.nav || {}),
      sourceBuckets: parseSourceBuckets(data?.ui),
    },
  }
}

const BUCKET_PREFERENCES_PATH = [
  '.quilt/catalog/config.yaml',
  '.quilt/catalog/config.yml',
]

const fetchBucketPreferences = async ({ s3, bucket }: { s3: any; bucket: string }) => {
  try {
    const response = await requests.fetchFile({
      s3,
      bucket,
      path: BUCKET_PREFERENCES_PATH,
    })
    return parse(response.Body.toString('utf-8'))
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
  const s3 = AWS.S3.use()
  const data = useData(fetchBucketPreferences, { s3, bucket })

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
