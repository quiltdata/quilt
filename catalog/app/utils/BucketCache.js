import S3 from 'aws-sdk/clients/s3'
import * as R from 'ramda'
import * as React from 'react'

import * as errors from 'containers/Bucket/errors'
import * as AWS from 'utils/AWS'
import * as Data from 'utils/Data'

const CacheCtx = React.createContext()

export function BucketCacheProvider({ children }) {
  const ref = React.useRef({})
  return <CacheCtx.Provider value={ref.current}>{children}</CacheCtx.Provider>
}

function bucketExists({ s3, bucket, cache }) {
  if (S3.prototype.bucketRegionCache[bucket]) return Promise.resolve()
  if (cache && cache[bucket]) return Promise.resolve()
  return s3
    .headBucket({ Bucket: bucket })
    .promise()
    .then(() => {
      // eslint-disable-next-line no-param-reassign
      if (cache) cache[bucket] = true
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

export function useBucketExistence(bucket) {
  const cache = React.useContext(CacheCtx)
  const s3 = AWS.S3.use()
  return Data.use(bucketExists, { s3, bucket, cache })
}

export { BucketCacheProvider as Provider }
