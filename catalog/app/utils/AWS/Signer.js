import * as React from 'react'

import { handleToHttpsUri } from 'utils/s3paths'
import { useGetCachedBucketRegion } from 'utils/BucketCache'

import * as Credentials from './Credentials'
import * as S3 from './S3'
import useShouldSign from './useShouldSign'

const DEFAULT_URL_EXPIRATION = 5 * 60 // in seconds
const POLL_INTERVAL = 10 // in seconds
const LAG = POLL_INTERVAL * 3

const Ctx = React.createContext({ urlExpiration: DEFAULT_URL_EXPIRATION })

export function useS3Signer({ urlExpiration: exp, forceProxy = false } = {}) {
  const ctx = React.useContext(Ctx)
  const urlExpiration = exp || ctx.urlExpiration
  Credentials.use().suspend()
  const s3 = S3.use()
  const shouldSign = useShouldSign()
  const getRegion = useGetCachedBucketRegion()
  return React.useCallback(
    ({ bucket, key, version }, opts) =>
      shouldSign(bucket)
        ? s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: key,
            VersionId: version,
            Expires: urlExpiration,
            forceProxy,
            ...opts,
          })
        : // TODO: handle ResponseContentDisposition for unsigned case
          handleToHttpsUri(
            { bucket, key, version },
            { proxy: forceProxy, region: getRegion(bucket) },
          ),
    [shouldSign, s3, urlExpiration, forceProxy, getRegion],
  )
}

function usePolling(callback, { interval = POLL_INTERVAL } = {}) {
  const callbackRef = React.useRef()
  callbackRef.current = callback
  React.useEffect(() => {
    const int = setInterval(() => {
      if (callbackRef.current) callbackRef.current(Date.now())
    }, interval * 1000)
    return () => {
      clearInterval(int)
    }
  }, [interval])
}

export function useDownloadUrl(handle, { filename = '', contentType = '' } = {}) {
  const { urlExpiration } = React.useContext(Ctx)
  const sign = useS3Signer()
  const filenameSuffix = filename ? `; filename="${filename}"` : ''
  const doSign = () => ({
    url: sign(handle, {
      ResponseContentDisposition: `attachment${filenameSuffix}`,
      ResponseContentType: contentType || 'binary/octet-stream',
    }),
    ts: Date.now(),
  })
  const [state, setState] = React.useState(doSign)
  usePolling((now) => {
    if ((now - state.ts) / 1000 > urlExpiration - LAG) {
      setState(doSign())
    }
  })
  return state.url
}

export function WithDownloadUrl({ handle, children }) {
  return children(useDownloadUrl(handle))
}

export const withDownloadUrl = (handle, callback) => (
  <WithDownloadUrl handle={handle}>{callback}</WithDownloadUrl>
)

export function AWSSignerProvider({ children, urlExpiration = DEFAULT_URL_EXPIRATION }) {
  return <Ctx.Provider value={{ urlExpiration }}>{children}</Ctx.Provider>
}

export const Provider = AWSSignerProvider
