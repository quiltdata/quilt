import * as R from 'ramda'
import * as React from 'react'

import * as AWS from 'utils/AWS'
import * as Config from 'utils/Config'
import { useData } from 'utils/Data'
import * as Sentry from 'utils/Sentry'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'

import { BucketPreferences, SentryInstance, parse } from './BucketPreferences'
import LocalProvider from './LocalProvider'

const BUCKET_PREFERENCES_PATH = [
  '.quilt/catalog/config.yaml',
  '.quilt/catalog/config.yml',
]

interface FetchBucketPreferencesArgs {
  s3: $TSFixMe
  bucket: string
  sentry: SentryInstance
}

async function fetchBucketPreferences({
  s3,
  sentry,
  bucket,
}: FetchBucketPreferencesArgs) {
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
      return parse('', sentry)

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

const Ctx = React.createContext<BucketPreferences | null>(null)

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const sentry = Sentry.use()
  const s3 = AWS.S3.use()
  const data = useData(fetchBucketPreferences, { s3, sentry, bucket })

  // XXX: consider returning AsyncResult or using Suspense
  const preferences = data.case({
    Ok: R.identity,
    Err: () => parse('', sentry),
    _: () => null,
  })
  return <Ctx.Provider value={preferences}>{children}</Ctx.Provider>
}

export function Provider({ bucket, children }: ProviderProps) {
  const cfg = Config.use()
  const local = cfg.mode === 'LOCAL'
  if (!local) return <LocalProvider context={Ctx}>{children}</LocalProvider>

  return <CatalogProvider bucket={bucket}>{children}</CatalogProvider>
}

export const useBucketPreferences = () => React.useContext(Ctx)

export const use = useBucketPreferences
