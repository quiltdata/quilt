import type { S3 } from 'aws-sdk'
import * as React from 'react'

import type * as Model from 'model'
import cfg from 'constants/config'
import * as quiltConfigs from 'constants/quiltConfigs'
import { FileNotFound, VersionNotFound } from 'containers/Bucket/errors'
import * as requests from 'containers/Bucket/requests'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'

import {
  BucketPreferences,
  BucketPreferencesInput,
  Result,
  merge,
  parse,
  validate,
} from './BucketPreferences'
import LocalProvider from './LocalProvider'

interface FetchBucketPreferencesArgs {
  s3: S3
  bucket: string
  counter: number
}

interface FetchBucketPreferencesOutput {
  body: string
  handle: Model.S3.S3ObjectLocation | null
}

async function fetchBucketPreferences({
  s3,
  bucket,
}: FetchBucketPreferencesArgs): Promise<FetchBucketPreferencesOutput> {
  try {
    const { handle, body } = await requests.fetchFileInCollection({
      s3,
      handles: quiltConfigs.bucketPreferences.map((key) => ({ bucket, key })),
    })
    return { body: body?.toString('utf-8') || '', handle }
  } catch (e) {
    if (e instanceof FileNotFound || e instanceof VersionNotFound) {
      return { body: '', handle: null }
    }

    // eslint-disable-next-line no-console
    console.log('Unable to fetch')
    // eslint-disable-next-line no-console
    console.error(e)
    throw e
  }
}

async function uploadBucketPreferences(
  s3: S3,
  bucket: string,
  update: BucketPreferencesInput,
) {
  const response = await fetchBucketPreferences({
    s3,
    bucket,
    counter: 1,
  })
  const updatedConfig = merge(response.body, update)
  const handle = response.handle || { bucket, key: quiltConfigs.bucketPreferences[0] }

  validate(updatedConfig)

  await s3
    .putObject({
      Bucket: handle.bucket,
      Key: handle.key,
      Body: updatedConfig,
    })
    .promise()
  return parse(updatedConfig, bucket)
}

interface State {
  handle: Model.S3.S3ObjectLocation | null
  prefs: Result
  update: (upd: BucketPreferencesInput) => Promise<BucketPreferences>
}

const Ctx = React.createContext<State>({
  handle: null,
  prefs: Result.Init(),
  update: () => Promise.reject(new Error('Bucket preferences context not initialized')),
})

type ProviderProps = React.PropsWithChildren<{ bucket: string }>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const s3 = AWS.S3.use()
  const [counter, setCounter] = React.useState(0)
  const data = useData(fetchBucketPreferences, { s3, bucket, counter })

  const update = React.useCallback(
    async (upd: BucketPreferencesInput) => {
      const preferences = await uploadBucketPreferences(s3, bucket, upd)
      setCounter((prev) => prev + 1)
      return preferences
    },
    [s3, bucket],
  )

  const prefs = data.case({
    Ok: ({ body }: FetchBucketPreferencesOutput) => {
      try {
        // You can adjust input here to add beta features if `settings?.beta`
        // For example,
        // const input = CatalogSettings.use()?.beta ? merge(body, {ui: { some: true }}) : body
        return Result.Ok(parse(body, bucket))
      } catch (e) {
        // eslint-disable-next-line no-console
        console.log('Unable to parse bucket preferences')
        // eslint-disable-next-line no-console
        console.error(e)
        return Result.Ok(parse('', bucket))
      }
    },
    Err: () => Result.Ok(parse('', bucket)),
    Pending: Result.Pending,
    Init: Result.Init,
  })
  const handle = data.case({
    Ok: (r: FetchBucketPreferencesOutput) => r.handle,
    _: () => null,
  })

  return <Ctx.Provider value={{ handle, prefs, update }}> {children} </Ctx.Provider>
}

export function Provider({ bucket, children }: ProviderProps) {
  if (cfg.mode === 'LOCAL') return <LocalProvider context={Ctx}>{children}</LocalProvider>

  return <CatalogProvider bucket={bucket}>{children}</CatalogProvider>
}

export const useBucketPreferences = () => React.useContext(Ctx)

export const use = useBucketPreferences
