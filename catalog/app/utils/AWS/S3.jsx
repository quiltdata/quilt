import S3 from 'aws-sdk/clients/s3'
import AWS from 'aws-sdk/lib/core'
import * as React from 'react'

import cfg from 'constants/config'
import useConstant from 'utils/useConstant'
import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'
import useShouldSign from './useShouldSign'

const DEFAULT_OPTS = {
  signatureVersion: 'v4',
  s3UsEast1RegionalEndpoint: 'regional',
  region: cfg.region,
}

const PROXIED = Symbol('proxied')
const PRESIGN = Symbol('presign')
const FORCE_PROXY = Symbol('forceProxy')

const Ctx = React.createContext()

/**
 * A React hook that returns a function with a stable identity, but which calls the
 * latest version of the function passed as an argument. This is useful to avoid
 * breaking memoization when a function is passed down as a prop, while still
 * being able to call the latest version of that function.
 */
function usePassThruFn(fn) {
  const fnRef = React.useRef()
  fnRef.current = fn
  return (...args) => fnRef.current(...args)
}

function useSmartS3() {
  // The SmartS3 class is created only once, so we need a stable reference to the
  // shouldSign function. usePassThruFn gives us a stable function that calls the
  // latest version of useShouldSign(), so we don't have a stale closure.
  const shouldSign = usePassThruFn(useShouldSign())

  return useConstant(() => {
    class SmartS3 extends S3 {
      shouldSign(req) {
        return shouldSign(req.params.Bucket)
      }

      customRequestHandler(req) {
        if (req.params.Bucket) {
          const endpoint = new AWS.Endpoint(cfg.s3Proxy)
          req.on('sign', () => {
            if (req.httpRequest[PRESIGN]) return

            // Monkey-patch the request object after it has been signed and save the original
            // values in case of retry.
            const origEndpoint = req.httpRequest.endpoint
            const origPath = req.httpRequest.path

            req.httpRequest[PROXIED] = {
              endpoint: origEndpoint,
              path: origPath,
            }
            const basePath = endpoint.path.replace(/\/$/, '')

            req.httpRequest.endpoint = endpoint
            req.httpRequest.path = `${basePath}/${origEndpoint.host}${origPath}`
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

        if (!this.shouldSign(req)) {
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
