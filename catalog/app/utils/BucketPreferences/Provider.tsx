import * as R from 'ramda'
import * as React from 'react'

import cfg from 'constants/config'
import * as quiltConfigs from 'constants/quiltConfigs'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import AsyncResult from 'utils/AsyncResult'
import * as CatalogSettings from 'utils/CatalogSettings'
import { useData } from 'utils/Data'
import * as Sentry from 'utils/Sentry'

import { BucketPreferences, SentryInstance, parse } from './BucketPreferences'
import LocalProvider from './LocalProvider'

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
      path: quiltConfigs.bucketPreferences,
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

const Ctx = React.createContext<{
  preferences: BucketPreferences | null
  result: $TSFixMe
}>({
  result: AsyncResult.Init(),
  preferences: null,
})

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const sentry = Sentry.use()
  const s3 = AWS.S3.use()
  const settings = CatalogSettings.use()
  const data = useData(fetchBucketPreferences, { s3, sentry, bucket })

  // XXX: migrate to AsyncResult
  const preferences = data.case({
    Ok: settings?.beta
      ? R.assocPath(['ui', 'actions', 'openInDesktop'], true)
      : R.identity,
    Err: () => parse('', sentry),
    _: () => null,
  })
  const result = preferences ? AsyncResult.Ok(preferences) : AsyncResult.Pending()
  return <Ctx.Provider value={{ preferences, result }}>{children}</Ctx.Provider>
}

export function Provider({ bucket, children }: ProviderProps) {
  if (cfg.mode === 'LOCAL') return <LocalProvider context={Ctx}>{children}</LocalProvider>

  return <CatalogProvider bucket={bucket}>{children}</CatalogProvider>
}

export const useBucketPreferences = () => React.useContext(Ctx)

export const use = useBucketPreferences
