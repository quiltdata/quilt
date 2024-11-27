import type { S3 } from 'aws-sdk'
import * as React from 'react'

import cfg from 'constants/config'
import * as quiltConfigs from 'constants/quiltConfigs'
import { FileNotFound, VersionNotFound } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import * as CatalogSettings from 'utils/CatalogSettings'
import { useData } from 'utils/Data'

import { sourceBucket, openInDesktop, merge, Result, parse } from './BucketPreferences'
import LocalProvider from './LocalProvider'

interface FetchBucketPreferencesArgs {
  s3: S3
  bucket: string
}

// TODO: return path
async function fetchBucketPreferences({
  s3,
  bucket,
}: FetchBucketPreferencesArgs): Promise<string> {
  try {
    const response = await requests.fetchFile({
      s3,
      bucket,
      path: quiltConfigs.bucketPreferences,
    })
    return response.Body.toString('utf-8')
  } catch (e) {
    if (e instanceof FileNotFound || e instanceof VersionNotFound) return ''

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

async function uploadBucketPreferences(s3: S3, bucket: string) {
  const response = await fetchBucketPreferences({
    s3,
    bucket,
  })
  const updatedConfig = merge(response, sourceBucket(bucket))
  return s3
    .putObject({
      Bucket: bucket,
      Key: quiltConfigs.bucketPreferences[0],
      Body: updatedConfig,
    })
    .promise()
}

export function useUploadBucketPreferences(bucket: string) {
  const s3 = AWS.S3.use()
  return React.useCallback(() => uploadBucketPreferences(s3, bucket), [bucket, s3])
}

const Ctx = React.createContext<Result>(Result.Init())

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const s3 = AWS.S3.use()
  const settings = CatalogSettings.use()
  const data = useData(fetchBucketPreferences, { s3, bucket })

  const preferences = data.case({
    Ok: (raw: string) => {
      try {
        const input = settings?.beta ? merge(raw, openInDesktop()) : raw
        return Result.Ok(parse(input))
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Unable to parse bucket preferences')
        // eslint-disable-next-line no-console
        console.error(e)
        return Result.Ok(parse(''))
      }
    },
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
