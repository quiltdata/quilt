import * as R from 'ramda'
import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as S3 from 'utils/AWS/S3'
import * as Data from 'utils/Data'
import log from 'utils/Logging'

const CacheCtx = React.createContext()

export function BucketCacheProvider({ children }) {
  const ref = React.useRef({ head: {}, region: {} })
  return <CacheCtx.Provider value={ref.current}>{children}</CacheCtx.Provider>
}

function bucketExists({ s3, bucket, cache }) {
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
            R.propEq('code', 'NotFound'),
            () => {
              throw new errors.NoSuchBucket()
            },
          ],
        ]),
      )
  }
  return cache.head[bucket]
}

export function useBucketExistence(bucket) {
  const cache = React.useContext(CacheCtx)
  const s3 = S3.use()
  return Data.use(bucketExists, { s3, bucket, cache })
}

export { BucketCacheProvider as Provider }

export function useGetCachedBucketRegion() {
  const cache = React.useContext(CacheCtx)
  return React.useCallback(
    (bucket) => {
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
