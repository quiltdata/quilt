import * as React from 'react'

import cfg from 'constants/config'
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
  const s3Factory = S3.useS3Factory()
  const shouldSign = useShouldSign()
  const getRegion = useGetCachedBucketRegion()
  return React.useCallback(
    // v3's presigner is async, so this returns a Promise<string>.
    async ({ bucket, key, version }, opts = {}) => {
      if (shouldSign(bucket)) {
        const s3 = s3Factory(getRegion(bucket))
        return s3.getSignedUrl('getObject', {
          Bucket: bucket,
          Key: key,
          VersionId: version,
          Expires: urlExpiration,
          forceProxy,
          ...opts,
        })
      }
      // TODO: handle ResponseContentDisposition for unsigned case
      return handleToHttpsUri(
        { bucket, key, version },
        { proxy: forceProxy && cfg.s3Proxy, region: getRegion(bucket) },
      )
    },
    [shouldSign, s3Factory, urlExpiration, forceProxy, getRegion],
  )
}

// Resolve the now-async signer into state for call sites that previously
// consumed `sign(handle)` synchronously. Returns `undefined` until resolved.
export function useSignedUrl(handle, opts) {
  const sign = useS3Signer(opts)
  const [url, setUrl] = React.useState(undefined)
  React.useEffect(() => {
    let mounted = true
    Promise.resolve(sign(handle)).then((u) => mounted && setUrl(u))
    return () => {
      mounted = false
    }
  }, [sign, handle])
  return url
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
  // sign() is async in v3 (presigner); resolve into state.
  const doSign = React.useCallback(
    () =>
      sign(handle, {
        ResponseContentDisposition: `attachment${filenameSuffix}`,
        ResponseContentType: contentType || 'binary/octet-stream',
      }),
    [sign, handle, filenameSuffix, contentType],
  )
  const [state, setState] = React.useState({ url: undefined, ts: Date.now() })
  React.useEffect(() => {
    let mounted = true
    doSign().then((url) => mounted && setState({ url, ts: Date.now() }))
    return () => {
      mounted = false
    }
  }, [doSign])
  usePolling((now) => {
    if ((now - state.ts) / 1000 > urlExpiration - LAG) {
      doSign().then((url) => setState({ url, ts: Date.now() }))
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
