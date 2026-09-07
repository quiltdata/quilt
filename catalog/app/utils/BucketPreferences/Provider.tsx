import type { S3 } from 'aws-sdk'
import invariant from 'invariant'
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
  // Widened for the provider's unscoped mode, where the fetch does not run.
  bucket: string | null
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
  invariant(bucket, 'Cannot fetch bucket preferences with no bucket in scope')
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

type ProviderProps = React.PropsWithChildren<{
  /**
   * The bucket whose preference document to read, or `null` for no bucket at all.
   *
   * `null` provides the state a consumer sees *outside* any provider -- no
   * document, no handle, no update -- rather than the subtree being unmounted.
   * That is what a consumer whose scope comes and goes at runtime needs: the
   * workspace Athena console is scoped by a `?bucket=` search param, and
   * branching the tree on that param instead would remount the console (and
   * discard the query being typed) every time the scope changed.
   */
  bucket: string | null
}>

function CatalogProvider({ bucket, children }: ProviderProps) {
  const s3 = AWS.S3.use()
  const [counter, setCounter] = React.useState(0)
  // `const`, so the narrowing below reaches the `data.case` arms.
  const scope = bucket
  const data = useData(
    fetchBucketPreferences,
    { s3, bucket: scope, counter },
    { noAutoFetch: !scope },
  )

  const update = React.useCallback(
    async (upd: BucketPreferencesInput) => {
      invariant(scope, 'Cannot update bucket preferences with no bucket in scope')
      const preferences = await uploadBucketPreferences(s3, scope, upd)
      setCounter((prev) => prev + 1)
      return preferences
    },
    [s3, scope],
  )

  const prefs: Result = scope
    ? data.case({
        Ok: ({ body }: FetchBucketPreferencesOutput) => {
          try {
            // You can adjust input here to add beta features if `settings?.beta`
            // For example,
            // const input = CatalogSettings.use()?.beta ? merge(body, {ui: { some: true }}) : body
            return Result.Ok(parse(body, scope))
          } catch (e) {
            // eslint-disable-next-line no-console
            console.log('Unable to parse bucket preferences')
            // eslint-disable-next-line no-console
            console.error(e)
            return Result.Ok(parse('', scope))
          }
        },
        Err: () => Result.Ok(parse('', scope)),
        Pending: Result.Pending,
        Init: Result.Init,
      })
    : // No bucket, so there is no document to be pending on either.
      Result.Init()
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
