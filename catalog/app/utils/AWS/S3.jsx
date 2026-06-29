import {
  S3Client,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  ListObjectVersionsCommand,
  GetObjectTaggingCommand,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl as presign } from '@aws-sdk/s3-request-presigner'
import * as React from 'react'

import cfg from 'constants/config'
import useConstant from 'utils/useConstant'
import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'
import useShouldSign from './useShouldSign'

const DEFAULT_OPTS = {
  region: cfg.region,
}

// Marker on a command's middlewareStack-visible context to request s3-proxy
// rewriting. We stash it on the command input under a symbol so it survives to
// our middleware but isn't serialized into the request.
const PROXY = Symbol('proxy')

// ---------------------------------------------------------------------------
// s3-proxy rewrite middleware (replaces aws-sdk v2 `req.on('sign', ...)`)
//
// In v2, SmartS3 mutated the already-signed httpRequest to point at cfg.s3Proxy
// and prepended `/<origHost><origPath>` to the path, reverting on retry because
// v2 reuses+mutates a single request object. In v3 every attempt builds a fresh
// HttpRequest from the serialized command, so there is nothing to revert — we
// just rewrite each request as it passes through. The middleware is registered
// relative to `awsAuthMiddleware` with `relation: 'after'` so it runs once the
// request is signed (matching the v2 'sign' hook ordering): the SigV4 signature
// is computed against the real S3 host, then we swap the wire destination to the
// proxy, exactly as v2 did.
// ---------------------------------------------------------------------------
function makeProxyMiddleware(proxyUrl) {
  const proxy = new URL(proxyUrl)
  const basePath = proxy.pathname.replace(/\/$/, '')
  return (next, context) => async (args) => {
    const req = args.request
    // only rewrite real HTTP requests that carry the proxy flag
    if (req && typeof req === 'object' && context[PROXY] && req.hostname) {
      const origHost = req.hostname
      const origPath = req.path
      req.protocol = proxy.protocol
      req.hostname = proxy.hostname
      req.port = proxy.port ? Number(proxy.port) : undefined
      req.path = `${basePath}/${origHost}${origPath}`
      // host header must follow, or the signature/proxy routing breaks
      if (req.headers) req.headers.host = proxy.host
    }
    return next(args)
  }
}

const PROXY_MIDDLEWARE_OPTS = {
  name: 's3ProxyRewrite',
  relation: 'after',
  toMiddleware: 'awsAuthMiddleware',
  override: true,
}

function applyProxyFlag(client, useProxy) {
  // pass the per-call proxy decision into the middleware via handler context
  client.middlewareStack.add(
    (next, context) => async (args) => {
      // eslint-disable-next-line no-param-reassign
      context[PROXY] = useProxy
      return next(args)
    },
    { step: 'initialize', name: 's3ProxyFlag', override: true },
  )
}

// Build a v2-shaped façade over a v3 S3Client so the ~25 existing consumers that
// call `s3.getObject(params).promise()` / `s3.getSignedUrl(...)` keep working
// while the runtime moves to v3 (which fixes the ES2020 class-ctor blocker).
// A later pass can replace this façade with idiomatic `client.send(command)`.
function makeFacade({ signedClient, anonClient, shouldSign, proxyUrl }) {
  const pickClient = (Bucket) => (shouldSign(Bucket) ? signedClient : anonClient)

  const run = (CommandCtor, params, { forceProxy = false } = {}) => {
    const client = pickClient(params?.Bucket)
    const useProxy = !!proxyUrl && (forceProxy || client === signedClient)
    applyProxyFlag(client, useProxy)
    // mimic v2's `request` object: `.promise()` resolves the send.
    return { promise: () => client.send(new CommandCtor(params)) }
  }

  const stripForceProxy = (params) => {
    if (params && 'forceProxy' in params) {
      const { forceProxy, ...rest } = params
      return { forceProxy, params: rest }
    }
    return { forceProxy: false, params }
  }

  const op =
    (CommandCtor) =>
    (rawParams = {}) => {
      const { forceProxy, params } = stripForceProxy(rawParams)
      return run(CommandCtor, params, { forceProxy })
    }

  return {
    getObject: op(GetObjectCommand),
    headObject: op(HeadObjectCommand),
    listObjectsV2: op(ListObjectsV2Command),
    listObjectVersions: op(ListObjectVersionsCommand),
    getObjectTagging: op(GetObjectTaggingCommand),
    putObject: op(PutObjectCommand),
    deleteObject: op(DeleteObjectCommand),

    // v2 getSignedUrl was synchronous; v3's presigner is async, so this returns
    // a Promise<string>. Callers (Signer.jsx) must await it.
    async getSignedUrl(operation, rawParams = {}) {
      if (operation !== 'getObject') {
        throw new Error(`getSignedUrl: unsupported operation "${operation}"`)
      }
      const { forceProxy, params } = stripForceProxy(rawParams)
      const { Expires, ...cmdParams } = params
      const client = pickClient(cmdParams.Bucket)
      const useProxy = !!proxyUrl && forceProxy
      applyProxyFlag(client, useProxy)
      return presign(client, new GetObjectCommand(cmdParams), {
        expiresIn: Expires,
      })
    },

    // expose the underlying v3 client for future idiomatic call sites
    _v3: signedClient,
  }
}

// Anonymous client: skip SigV4 by overriding the signer with a noop identity
// signer (the v3 equivalent of v2's `req.toUnauthenticated()`).
const noopSigner = { sign: async (request) => request }

function makeClients(opts, proxyUrl) {
  const base = { ...opts }
  const signedClient = new S3Client(base)
  const anonClient = new S3Client({ ...base, signer: () => Promise.resolve(noopSigner) })
  if (proxyUrl) {
    const mw = makeProxyMiddleware(proxyUrl)
    signedClient.middlewareStack.addRelativeTo(mw, PROXY_MIDDLEWARE_OPTS)
    anonClient.middlewareStack.addRelativeTo(mw, PROXY_MIDDLEWARE_OPTS)
  }
  return { signedClient, anonClient }
}

const Ctx = React.createContext()

/**
 * A React hook that returns a function with a stable identity, but which calls the
 * latest version of the function passed as an argument.
 */
function usePassThruFn(fn) {
  const fnRef = React.useRef()
  fnRef.current = fn
  return (...args) => fnRef.current(...args)
}

function useFacadeFactory(awsCfg, overrides) {
  const shouldSign = usePassThruFn(useShouldSign())
  const stableShouldSign = useConstant(() => (bucket) => shouldSign(bucket))

  return useMemoEqLazy({ ...awsCfg, ...DEFAULT_OPTS, ...overrides }, (opts) => {
    const facades = {}
    return (region) => {
      const r = region || opts.region
      if (!facades[r]) {
        const { signedClient, anonClient } = makeClients(
          { ...opts, region: r },
          cfg.s3Proxy,
        )
        facades[r] = makeFacade({
          signedClient,
          anonClient,
          shouldSign: stableShouldSign,
          proxyUrl: cfg.s3Proxy,
        })
      }
      return facades[r]
    }
  })
}

export const Provider = function S3Provider({ children, ...overrides }) {
  const awsCfg = Config.use()
  const clientFactory = useFacadeFactory(awsCfg, overrides)
  return <Ctx.Provider value={clientFactory}>{children}</Ctx.Provider>
}

// Returns an S3 client (façade) for the default region (cfg.region).
export function useS3() {
  const factory = useS3Factory()
  return factory()
}

// Returns a factory (region?) => S3 façade that caches clients per region.
export function useS3Factory() {
  Credentials.use().suspend()
  return React.useContext(Ctx)()
}

export const use = useS3
