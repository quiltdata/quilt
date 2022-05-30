import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as Sentry from 'utils/Sentry'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

import {
  BucketPreferences,
  SentryInstance,
  defaultPreferences,
  parse,
} from './BucketPreferences'

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

// TODO: ProviderWrapper LocalProvider
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
