import * as React from 'react'
import * as redux from 'react-redux'

import * as authSelectors from 'containers/Auth/selectors'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import { handleToHttpsUri } from 'utils/s3paths'

import * as Credentials from './Credentials'
import * as S3 from './S3'

const DEFAULT_URL_EXPIRATION = 5 * 60 // in seconds
const POLL_INTERVAL = 10 // in seconds
const LAG = POLL_INTERVAL * 3

const Ctx = React.createContext({ urlExpiration: DEFAULT_URL_EXPIRATION })

export function useS3Signer({ urlExpiration: exp, forceProxy = false } = {}) {
  const ctx = React.useContext(Ctx)
  const urlExpiration = exp || ctx.urlExpiration
  Credentials.use().suspend()
  const authenticated = redux.useSelector(authSelectors.authenticated)
  const { mode } = Config.useConfig()
  const isInStack = BucketConfig.useIsInStack()
  const s3 = S3.use()
  return React.useCallback(
    ({ bucket, key, version }, opts) =>
      mode !== 'OPEN' && (mode === 'LOCAL' || (isInStack(bucket) && authenticated))
        ? s3.getSignedUrl('getObject', {
            Bucket: bucket,
            Key: key,
            VersionId: version,
            Expires: urlExpiration,
            forceProxy,
            ...opts,
          })
        : handleToHttpsUri({ bucket, key, version }), // TODO: handle ResponseContentDisposition for unsigned case
    [mode, isInStack, authenticated, s3, urlExpiration, forceProxy],
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

export function useDownloadUrl(handle) {
  const { urlExpiration } = React.useContext(Ctx)
  const sign = useS3Signer()
  const doSign = () => ({
    url: sign(handle, {
      ResponseContentDisposition: 'attachment',
      ResponseContentType: 'binary/octet-stream',
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
