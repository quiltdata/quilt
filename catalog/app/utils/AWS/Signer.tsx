import * as React from 'react'

import cfg from 'constants/config'
import { S3ObjectLocation, handleToHttpsUri } from 'utils/s3paths'
import { useGetCachedBucketRegion } from 'utils/BucketCache'

import * as Credentials from './Credentials'
import * as S3 from './S3'
import useShouldSign from './useShouldSign'

const DEFAULT_URL_EXPIRATION = 5 * 60 // in seconds
const POLL_INTERVAL = 10 // in seconds
const LAG = POLL_INTERVAL * 3

interface SignerContext {
  urlExpiration: number
}

const Ctx = React.createContext<SignerContext>({ urlExpiration: DEFAULT_URL_EXPIRATION })

interface UseS3SignerOptions {
  urlExpiration?: number // in seconds
  forceProxy?: boolean
}

// Extra options are forwarded as-is to S3.getSignedUrl (e.g.
// ResponseContentType, ResponseContentDisposition), so keep the sign options
// permissive rather than tied to S3SignerOptions.
// loose so it stays compatible with consumers' own signer option types
type SignOptions = any

export function useS3Signer({
  urlExpiration: exp,
  forceProxy = false,
}: UseS3SignerOptions = {}) {
  const ctx = React.useContext(Ctx)
  const urlExpiration = exp || ctx.urlExpiration
  Credentials.use().suspend()
  const s3Factory = S3.useS3Factory()
  const shouldSign = useShouldSign()
  const getRegion = useGetCachedBucketRegion()
  return React.useCallback(
    ({ bucket, key, version }: S3ObjectLocation, opts: SignOptions = {}): string => {
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

interface UsePollingOptions {
  interval?: number
}

function usePolling(
  callback: (now: number) => void,
  { interval = POLL_INTERVAL }: UsePollingOptions = {},
) {
  const callbackRef = React.useRef<(now: number) => void>()
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

interface UseDownloadUrlOptions {
  filename?: string
  contentType?: string
}

export function useDownloadUrl(
  handle: S3ObjectLocation,
  { filename = '', contentType = '' }: UseDownloadUrlOptions = {},
) {
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

interface WithDownloadUrlProps {
  handle: S3ObjectLocation
  children: (url: string) => React.ReactNode
}

export function WithDownloadUrl({ handle, children }: WithDownloadUrlProps) {
  return <>{children(useDownloadUrl(handle))}</>
}

export const withDownloadUrl = (
  handle: S3ObjectLocation,
  callback: (url: string) => React.ReactNode,
) => <WithDownloadUrl handle={handle}>{callback}</WithDownloadUrl>

interface AWSSignerProviderProps {
  children: React.ReactNode
  urlExpiration?: number
}

export function AWSSignerProvider({
  children,
  urlExpiration = DEFAULT_URL_EXPIRATION,
}: AWSSignerProviderProps) {
  return <Ctx.Provider value={{ urlExpiration }}>{children}</Ctx.Provider>
}

export const Provider = AWSSignerProvider
