import * as R from 'ramda'
import * as React from 'react'

import cfg from 'constants/config'
import * as quiltConfigs from 'constants/quiltConfigs'
import * as bucketErrors from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as CatalogSettings from 'utils/CatalogSettings'
import { useData } from 'utils/Data'

import { Result, parse } from './BucketPreferences'
import LocalProvider from './LocalProvider'

interface FetchBucketPreferencesArgs {
  s3: $TSFixMe
  bucket: string
}

async function fetchBucketPreferences({ s3, bucket }: FetchBucketPreferencesArgs) {
  try {
    const response = await requests.fetchFile({
      s3,
      bucket,
      path: quiltConfigs.bucketPreferences,
    })
    return parse(response.Body.toString('utf-8'))
  } catch (e) {
    if (
      e instanceof bucketErrors.FileNotFound ||
      e instanceof bucketErrors.VersionNotFound
    )
      return parse('')

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

const Ctx = React.createContext<Result>(Result.Init())

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const s3 = AWS.S3.use()
  const settings = CatalogSettings.use()
  const data = useData(fetchBucketPreferences, { s3, bucket })

  const preferences = data.case({
    Ok: settings?.beta
      ? R.pipe(R.assocPath(['ui', 'actions', 'openInDesktop'], true), Result.Ok)
      : Result.Ok,
    Err: () => Result.Ok(parse('')),
    Pending: Result.Pending,
    Init: Result.Init,
  })
  return <Ctx.Provider value={preferences}> {children} </Ctx.Provider>
}

export function Provider({ bucket, children }: ProviderProps) {
  if (cfg.mode === 'LOCAL') return <LocalProvider context={Ctx}>{children}</LocalProvider>

  return <CatalogProvider bucket={bucket}>{children}</CatalogProvider>
}

export const useBucketPreferences = () => React.useContext(Ctx)

export const use = useBucketPreferences
