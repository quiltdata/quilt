import S3 from 'aws-sdk/clients/s3'
import AWS from 'aws-sdk/lib/core'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Auth from 'containers/Auth'
import * as BucketConfig from 'utils/BucketConfig'
import { useConfig } from 'utils/Config'
import * as RT from 'utils/reactTools'
import useMemoEq from 'utils/useMemoEq'

import * as Config from './Config'
import * as Credentials from './Credentials'

const DEFAULT_OPTS = {
  signatureVersion: 'v4',
  s3UsEast1RegionalEndpoint: 'regional',
}

const Ctx = React.createContext(DEFAULT_OPTS)

export const Provider = RT.composeComponent(
  'AWS.S3.Provider',
  ({ children, ...props }) => {
    const prev = React.useContext(Ctx)
    const value = { ...prev, ...props }
    return <Ctx.Provider value={value}>{children}</Ctx.Provider>
  },
)

export const useS3 = (extra, extend = {}) => {
  const config = Config.use()
  Credentials.use().suspend()
  const props = React.useContext(Ctx)
  // TODO: use cache?
  return useMemoEq({ cfg: { ...config, ...props, ...extra }, extend }, (opts) =>
    Object.assign(new S3(opts.cfg), opts.extend),
  )
}

export const use = useS3

const PROXIED = Symbol('proxied')

export const useRequest = (extra) => {
  const cfg = useConfig()
  const authenticated = reduxHook.useMappedState(Auth.selectors.authenticated)
  const isInStack = BucketConfig.useIsInStack()
  const proxyEndpoint = React.useMemo(() => new AWS.Endpoint(cfg.s3Proxy), [cfg.s3Proxy])
  const customRequestHandler = React.useCallback(
    (req) => {
      const b = req.params.Bucket
      if (b) {
        req.on('sign', () => {
          // Monkey-patch the request object after it has been signed and save the original
          // values in case of retry.
          req.httpRequest[PROXIED] = {
            endpoint: req.httpRequest.endpoint,
            path: req.httpRequest.path,
          }
          req.httpRequest.endpoint = proxyEndpoint
          req.httpRequest.path = `/${req.httpRequest.region}/${b}${req.httpRequest.path}`
        })
        req.on(
          'retry',
          () => {
            // Revert our patch so that the request can be re-signed in case of retry.
            // AWS SDK reuses and mutates the httpRequest object, so we have to track our
            // monkey-patching to avoid applying it repeatedly.
            if (req.httpRequest[PROXIED]) {
              req.httpRequest.endpoint = req.httpRequest[PROXIED].endpoint
              req.httpRequest.path = req.httpRequest[PROXIED].path
              delete req.httpRequest[PROXIED]
            }
          },
          true,
        )
      }
    },
    [cfg, proxyEndpoint],
  )
  const regularClient = useS3(extra, { customRequestHandler })
  const s3SelectClient = useS3({
    endpoint: `${cfg.binaryApiGatewayEndpoint}/s3select/`,
    s3ForcePathStyle: true,
    ...extra,
  })
  return React.useCallback(
    ({ operation, params }) => {
      let type = 'unsigned'
      if (cfg.mode === 'LOCAL') {
        type = 'signed'
      } else if (authenticated) {
        if (
          // sign if operation is not bucket-specific
          // (not sure if there are any such operations that can be used from the browser)
          !params.Bucket ||
          (cfg.analyticsBucket && cfg.analyticsBucket === params.Bucket) ||
          (cfg.mode !== 'OPEN' && isInStack(params.Bucket))
        ) {
          type = 'signed'
        }
      } else if (operation === 'selectObjectContent') {
        type = 'select'
      }
      const [client, method] = {
        signed: [regularClient, 'makeRequest'],
        unsigned: [regularClient, 'makeUnauthenticatedRequest'],
        select: [s3SelectClient, 'makeUnauthenticatedRequest'],
      }[type]
      return client[method](operation, params).promise()
    },
    [regularClient, s3SelectClient, authenticated, cfg, isInStack],
  )
}

export const inject = (prop = 's3') =>
  RT.composeHOC('AWS.S3.inject', (Component) => (props) => {
    const s3 = use()
    return <Component {...{ [prop]: s3, ...props }} />
  })

export const injectRequest = (prop = 's3req') =>
  RT.composeHOC('AWS.S3.inject', (Component) => (props) => {
    const s3req = useRequest()
    return <Component {...{ [prop]: s3req, ...props }} />
  })

export const Inject = ({ children }) => children(use())

export const InjectRequest = ({ children }) => children(useRequest())
