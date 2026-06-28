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

// aws-sdk's public types don't expose the internal request fields (`params`,
// `toUnauthenticated`) or our monkey-patched symbol slots on `httpRequest`, so
// we describe the loose runtime shape we actually touch here.
interface PatchedHttpRequest extends AWS.HttpRequest {
  [PROXIED]?: { endpoint: AWS.Endpoint; path: string }
  [PRESIGN]?: boolean
  [FORCE_PROXY]?: boolean
}

interface SmartRequest extends AWS.Request<any, AWS.AWSError> {
  params?: { Bucket?: string; forceProxy?: boolean; [key: string]: any }
  httpRequest: PatchedHttpRequest
  toUnauthenticated(): void
}

// `prepareSignedUrl` is an internal aws-sdk method that isn't part of the public
// S3 type; cast the base so we can call/override it without altering behavior.
const S3Base = S3 as unknown as {
  new (...args: ConstructorParameters<typeof S3>): S3 & {
    prepareSignedUrl(req: SmartRequest): void
  }
}

type S3Client = S3

const Ctx = React.createContext<(() => (region?: string) => S3Client) | null>(null)

/**
 * A React hook that returns a function with a stable identity, but which calls the
 * latest version of the function passed as an argument. This is useful to avoid
 * breaking memoization when a function is passed down as a prop, while still
 * being able to call the latest version of that function.
 */
function usePassThruFn<A extends any[], R>(fn: (...args: A) => R) {
  const fnRef = React.useRef(fn)
  fnRef.current = fn
  return (...args: A) => fnRef.current(...args)
}

function useSmartS3() {
  // The SmartS3 class is created only once, so we need a stable reference to the
  // shouldSign function. usePassThruFn gives us a stable function that calls the
  // latest version of useShouldSign(), so we don't have a stale closure.
  const shouldSign = usePassThruFn(useShouldSign())

  return useConstant(() => {
    class SmartS3 extends S3Base {
      shouldSign(req: SmartRequest) {
        return shouldSign(req.params?.Bucket)
      }

      customRequestHandler(req: SmartRequest) {
        if (req.params?.Bucket) {
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
            const basePath = (endpoint as any).path.replace(/\/$/, '')

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

      prepareSignedUrl(req: SmartRequest) {
        super.prepareSignedUrl(req)
        if (!req.httpRequest[FORCE_PROXY]) req.httpRequest[PRESIGN] = true
      }

      makeRequest(
        operation: string,
        params?: { [key: string]: any } | ((err: AWS.AWSError, data: any) => void),
        callback?: (err: AWS.AWSError, data: any) => void,
      ) {
        if (typeof params === 'function') {
          // eslint-disable-next-line no-param-reassign
          callback = params as (err: AWS.AWSError, data: any) => void
          // eslint-disable-next-line no-param-reassign
          params = undefined
        }

        const forceProxy = params?.forceProxy ?? false
        delete params?.forceProxy
        const req = super.makeRequest(operation, params) as SmartRequest
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

type ProviderProps = React.PropsWithChildren<Partial<S3.ClientConfiguration>>

export const Provider = function S3Provider({ children, ...overrides }: ProviderProps) {
  const awsCfg = Config.use()

  const SmartS3 = useSmartS3()

  const clientFactory = useMemoEqLazy(
    { ...awsCfg, ...DEFAULT_OPTS, ...overrides } as S3.ClientConfiguration,
    (opts: S3.ClientConfiguration) => {
      const clients: { [region: string]: S3Client } = {}
      return (region?: string) => {
        const r = region || opts.region!
        if (!clients[r]) {
          clients[r] = new SmartS3({ ...opts, region: r })
        }
        return clients[r]
      }
    },
  )

  return <Ctx.Provider value={clientFactory}>{children}</Ctx.Provider>
}

// Returns an S3 client for the default region (cfg.region).
// Use useS3Factory() when you need a client for a specific bucket region.
export function useS3() {
  const factory = useS3Factory()
  return factory()
}

// Returns a factory (region?) => S3Client that caches clients per region.
// Pass a region to get a region-specific client, or omit for the default (cfg.region).
export function useS3Factory() {
  Credentials.use().suspend()
  return React.useContext(Ctx)!()
}

export const use = useS3
