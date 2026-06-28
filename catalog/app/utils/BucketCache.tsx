import type { S3 as S3Client } from 'aws-sdk'
import * as R from 'ramda'
import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as S3 from 'utils/AWS/S3'
import * as Data from 'utils/Data'
import log from 'utils/Logging'

interface Cache {
  head: Record<string, Promise<void>>
  region: Record<string, string | undefined>
}

const CacheCtx = React.createContext<Cache | null>(null)

interface BucketCacheProviderProps {
  children: React.ReactNode
}

export function BucketCacheProvider({ children }: BucketCacheProviderProps) {
  const ref = React.useRef<Cache>({ head: {}, region: {} })
  return <CacheCtx.Provider value={ref.current}>{children}</CacheCtx.Provider>
}

interface BucketExistsParams {
  s3: S3Client
  bucket: string
  cache: Cache
}

function bucketExists({ s3, bucket, cache }: BucketExistsParams) {
  if (!cache.head[bucket]) {
    // eslint-disable-next-line no-param-reassign
    cache.head[bucket] = s3
      .headBucket({ Bucket: bucket })
      .promise()
      .then((r) => {
        cache.region[bucket] = r.BucketRegion
      })
      .catch(
        errors.catchErrors([
          [
            R.propEq('code', 'NotFound') as (e: unknown) => boolean,
            () => {
              throw new errors.NoSuchBucket()
            },
          ],
        ]),
      )
  }
  return cache.head[bucket]
}

export function useBucketExistence(bucket: string) {
  const cache = React.useContext(CacheCtx) as Cache
  const s3 = S3.use()
  return Data.use(bucketExists, { s3, bucket, cache })
}

export { BucketCacheProvider as Provider }

export function useGetCachedBucketRegion() {
  const cache = React.useContext(CacheCtx) as Cache
  return React.useCallback(
    (bucket: string) => {
      const region = cache.region[bucket]
      if (!region) {
        log.warn(
          `useGetCachedBucketRegion: region not cached for bucket "${bucket}".`,
          'useBucketExistence(bucket) must be called first — its headBucket call populates the region cache.',
        )
      }
      return region
    },
    [cache.region],
  )
}
