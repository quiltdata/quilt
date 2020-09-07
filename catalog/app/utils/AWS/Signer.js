import SignerV4 from 'aws-sdk/lib/signers/v4'
import * as React from 'react'
import * as redux from 'react-redux'

import * as Auth from 'containers/Auth'
import * as BucketConfig from 'utils/BucketConfig'
import * as Config from 'utils/Config'
import * as Resource from 'utils/Resource'
import { composeHOC } from 'utils/reactTools'
import { resolveKey, handleToHttpsUri } from 'utils/s3paths'

import * as Credentials from './Credentials'
import * as S3 from './S3'

const DEFAULT_URL_EXPIRATION = 5 * 60 // in seconds
const POLL_INTERVAL = 10 // in seconds
const LAG = POLL_INTERVAL * 3

const Ctx = React.createContext({ urlExpiration: DEFAULT_URL_EXPIRATION })

export function useRequestSigner() {
  const authenticated = redux.useSelector(Auth.selectors.authenticated)
  const { mode } = Config.useConfig()
  const credentials = Credentials.use().suspend()
  return React.useCallback(
    (request, serviceName) => {
      if (mode === 'LOCAL' || authenticated) {
        const signer = new SignerV4(request, serviceName)
        signer.addAuthorization(credentials, new Date())
      }
    },
    [credentials, authenticated, mode],
  )
}

export function useS3Signer({ urlExpiration: exp } = {}) {
  const ctx = React.useContext(Ctx)
  const urlExpiration = exp || ctx.urlExpiration
  Credentials.use().suspend()
  const authenticated = redux.useSelector(Auth.selectors.authenticated)
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
            ...opts,
          })
        : handleToHttpsUri({ bucket, key, version }), // TODO: handle ResponseContentDisposition for unsigned case
    [mode, isInStack, authenticated, s3, urlExpiration],
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
  }, [])
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

/*
Resource.Pointer handling / signing:

------------------+------------+-------------------+--------------------------+
context           | "web" urls | s3:// urls        | paths                    |
------------------+------------+-------------------+--------------------------+
MDImg             | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
MDLink            | as is      | parsed, signed,   | as is (relative to the   |
                  |            | relative to the   | current web UI URL)      |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
Summary           | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
Spec              | as is      | parsed, signed,   | considered an s3 url     |
                  |            | relative to the   |                          |
                  |            | containing file   |                          |
------------------+------------+-------------------+--------------------------+
*/
export function useResourceSigner() {
  const sign = useS3Signer()
  return React.useCallback(
    ({ ctx, ptr }) =>
      Resource.Pointer.case(
        {
          Web: (url) => url,
          S3: ({ bucket, key, version }) =>
            sign({
              bucket: bucket || ctx.handle.bucket,
              key,
              version,
            }),
          S3Rel: (path) =>
            sign({
              bucket: ctx.handle.bucket,
              key: resolveKey(ctx.handle.key, path),
            }),
          Path: (path) =>
            Resource.ContextType.case(
              {
                MDLink: () => path,
                _: () =>
                  sign({
                    bucket: ctx.handle.bucket,
                    key: resolveKey(ctx.handle.key, path),
                  }),
              },
              ctx.type,
            ),
        },
        ptr,
      ),
    [sign],
  )
}

export function AWSSignerProvider({ children, urlExpiration = DEFAULT_URL_EXPIRATION }) {
  return <Ctx.Provider value={{ urlExpiration }}>{children}</Ctx.Provider>
}

export const Provider = AWSSignerProvider

export function useSigner() {
  return {
    signRequest: useRequestSigner(),
    getSignedS3URL: useS3Signer(),
    signResource: useResourceSigner(),
  }
}

export const use = useSigner

export const inject = (prop = 'signer') =>
  composeHOC('AWS.Signer.inject', (Component) => (props) => {
    const signer = use()
    return <Component {...{ ...props, [prop]: signer }} />
  })

export const Inject = ({ children }) => children(use())
