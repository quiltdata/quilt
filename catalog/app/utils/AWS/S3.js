import S3 from 'aws-sdk/clients/s3'
import AWS from 'aws-sdk/lib/core'
import * as React from 'react'
import * as redux from 'react-redux'

import * as authSelectors from 'containers/Auth/selectors'
import * as BucketConfig from 'utils/BucketConfig'
import { useConfig } from 'utils/Config'
import useConstant from 'utils/useConstant'
import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'

const DEFAULT_OPTS = {
  signatureVersion: 'v4',
  s3UsEast1RegionalEndpoint: 'regional',
}

const PROXIED = Symbol('proxied')
const PRESIGN = Symbol('presign')
const FORCE_PROXY = Symbol('forceProxy')

const Ctx = React.createContext()

function useTracking(val) {
  const ref = React.useRef()
  ref.current = val
  return () => ref.current
}

function useTrackingFn(fn) {
  const get = useTracking(fn)
  return (...args) => get()(...args)
}

function useSmartS3() {
  const cfg = useConfig()
  const selectEndpoint = `${cfg.binaryApiGatewayEndpoint}/s3select/`
  const isAuthenticated = useTracking(redux.useSelector(authSelectors.authenticated))
  const isInStack = useTrackingFn(BucketConfig.useIsInStack())

  return useConstant(() => {
    class SmartS3 extends S3 {
      getReqType(req) {
        const bucket = req.params.Bucket
        if (cfg.mode === 'LOCAL') {
          return 'signed'
        }
        if (isAuthenticated()) {
          if (
            // sign if operation is not bucket-specific
            // (not sure if there are any such operations that can be used from the browser)
            !bucket ||
            (cfg.analyticsBucket && cfg.analyticsBucket === bucket) ||
            (cfg.serviceBucket && cfg.serviceBucket === bucket) ||
            (cfg.mode !== 'OPEN' && isInStack(bucket))
          ) {
            return 'signed'
          }
        } else if (req.operation === 'selectObjectContent') {
          return 'select'
        }
        return 'unsigned'
      }

      populateURI(req) {
        if (req.service.getReqType(req) === 'select') {
          return
        }
        super.populateURI(req)
      }

      customRequestHandler(req) {
        const b = req.params.Bucket
        const type = this.getReqType(req)

        if (b) {
          const endpoint = new AWS.Endpoint(
            type === 'select' ? selectEndpoint : cfg.s3Proxy,
          )
          req.on('sign', () => {
            if (req.httpRequest[PRESIGN]) return
            // Monkey-patch the request object after it has been signed and save the original
            // values in case of retry.
            req.httpRequest[PROXIED] = {
              endpoint: req.httpRequest.endpoint,
              path: req.httpRequest.path,
            }
            const basePath = endpoint.path.replace(/\/$/, '')
            req.httpRequest.endpoint = endpoint
            req.httpRequest.path =
              type === 'select'
                ? `${basePath}${req.httpRequest.path}`
                : `${basePath}/${req.httpRequest.region}/${b}${req.httpRequest.path}`
          })
          req.on(
            'retry',
            () => {
              if (req.httpRequest[PRESIGN]) return
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
      }

      prepareSignedUrl(req) {
        super.prepareSignedUrl(req)
        if (!req.httpRequest[FORCE_PROXY]) req.httpRequest[PRESIGN] = true
      }

      makeRequest(operation, params, callback) {
        if (typeof params === 'function') {
          // eslint-disable-next-line no-param-reassign
          callback = params
          // eslint-disable-next-line no-param-reassign
          params = null
        }

        const forceProxy = params?.forceProxy ?? false
        delete params?.forceProxy
        const req = super.makeRequest(operation, params)
        if (forceProxy) {
          req.httpRequest[FORCE_PROXY] = true
        }
        const type = this.getReqType(req)

        if (type !== 'signed') {
          req.toUnauthenticated()
        }

        if (callback) req.send(callback)
        return req
      }
    }

    return SmartS3
  })
}

export const Provider = function S3Provider({ children, ...overrides }) {
  const awsCfg = Config.use()

  const SmartS3 = useSmartS3()

  const client = useMemoEqLazy(
    { ...awsCfg, ...DEFAULT_OPTS, ...overrides },
    (opts) => new SmartS3(opts),
  )

  return <Ctx.Provider value={client}>{children}</Ctx.Provider>
}

export function useS3() {
  Credentials.use().suspend()
  return React.useContext(Ctx)()
}

export const use = useS3
