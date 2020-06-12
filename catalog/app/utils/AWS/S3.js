import S3 from 'aws-sdk/clients/s3'
import AWS from 'aws-sdk/lib/core'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Auth from 'containers/Auth'
import * as BucketConfig from 'utils/BucketConfig'
import { useConfig } from 'utils/Config'

import * as Config from './Config'
import * as Credentials from './Credentials'

const SELECT_METHODS = ['selectObjectContent']

const PROXY_METHODS = [
  'abortMultipartUpload',
  'completeMultipartUpload',
  'copyObject',
  'createBucket',
  'createMultipartUpload',
  'deleteBucket',
  'deleteBucketAnalyticsConfiguration',
  'deleteBucketCors',
  'deleteBucketEncryption',
  'deleteBucketInventoryConfiguration',
  'deleteBucketLifecycle',
  'deleteBucketMetricsConfiguration',
  'deleteBucketPolicy',
  'deleteBucketReplication',
  'deleteBucketTagging',
  'deleteBucketWebsite',
  'deleteObject',
  'deleteObjects',
  'deleteObjectTagging',
  'deletePublicAccessBlock',
  'getBucketAccelerateConfiguration',
  'getBucketAcl',
  'getBucketAnalyticsConfiguration',
  'getBucketCors',
  'getBucketEncryption',
  'getBucketInventoryConfiguration',
  'getBucketLifecycle',
  'getBucketLifecycleConfiguration',
  'getBucketLocation',
  'getBucketLogging',
  'getBucketMetricsConfiguration',
  'getBucketNotification',
  'getBucketNotificationConfiguration',
  'getBucketPolicy',
  'getBucketPolicyStatus',
  'getBucketReplication',
  'getBucketRequestPayment',
  'getBucketTagging',
  'getBucketVersioning',
  'getBucketWebsite',
  'getObject',
  'getObjectAcl',
  'getObjectLegalHold',
  'getObjectLockConfiguration',
  'getObjectRetention',
  'getObjectTagging',
  'getObjectTorrent',
  'getPublicAccessBlock',
  'headBucket',
  'headObject',
  'listBucketAnalyticsConfigurations',
  'listBucketInventoryConfigurations',
  'listBucketMetricsConfigurations',
  'listBuckets',
  'listMultipartUploads',
  'listObjects',
  'listObjectsV2',
  'listObjectVersions',
  'listParts',
  'putBucketAccelerateConfiguration',
  'putBucketAcl',
  'putBucketAnalyticsConfiguration',
  'putBucketCors',
  'putBucketEncryption',
  'putBucketInventoryConfiguration',
  'putBucketLifecycle',
  'putBucketLifecycleConfiguration',
  'putBucketLogging',
  'putBucketMetricsConfiguration',
  'putBucketNotification',
  'putBucketNotificationConfiguration',
  'putBucketPolicy',
  'putBucketReplication',
  'putBucketRequestPayment',
  'putBucketTagging',
  'putBucketVersioning',
  'putBucketWebsite',
  'putObject',
  'putObjectAcl',
  'putObjectLegalHold',
  'putObjectLockConfiguration',
  'putObjectRetention',
  'putObjectTagging',
  'putPublicAccessBlock',
  'restoreObject',
  'uploadPart',
  'uploadPartCopy',
]

const SIGN_METHODS = ['getSignedUrl', 'createPresignedPost']

const DEFAULT_OPTS = {
  signatureVersion: 'v4',
  s3UsEast1RegionalEndpoint: 'regional',
}

const PROXIED = Symbol('proxied')

const Ctx = React.createContext()

function useLazy(cons) {
  const ref = React.useRef()
  return function get() {
    if (!ref.current) {
      ref.current = cons()
    }
    return ref.current
  }
}

function useConstant(cons) {
  const ref = React.useRef()
  if (!ref.current) {
    ref.current = cons()
  }
  return ref.current
}

function useProxyingRequestHandler(s3Proxy) {
  const proxyEndpoint = React.useMemo(() => new AWS.Endpoint(s3Proxy), [s3Proxy])
  return React.useCallback(
    function proxyingRequestHandler(req) {
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
    [proxyEndpoint],
  )
}

export const Provider = function S3Provider({ children, ...overrides }) {
  const cfg = useConfig()
  const awsCfg = Config.use()
  const authenticated = reduxHook.useMappedState(Auth.selectors.authenticated)
  const isInStack = BucketConfig.useIsInStack()

  const customRequestHandler = useProxyingRequestHandler(cfg.s3Proxy)

  const getSelectClient = useLazy(
    () =>
      new S3({
        ...awsCfg,
        ...DEFAULT_OPTS,
        ...overrides,
        endpoint: `${cfg.binaryApiGatewayEndpoint}/s3select/`,
        s3ForcePathStyle: true,
      }),
  )

  const getProxyingClient = useLazy(() =>
    Object.assign(new S3({ ...awsCfg, ...DEFAULT_OPTS, ...overrides }), {
      customRequestHandler,
    }),
  )

  const getSigningClient = useLazy(
    () => new S3({ ...awsCfg, ...DEFAULT_OPTS, ...overrides }),
  )

  const callDirect = (op, ...args) => getProxyingClient()[op](...args)
  const callUnsigned = (...args) =>
    getProxyingClient().makeUnauthenticatedRequest(...args)
  const callSelect = (...args) => getSelectClient().makeUnauthenticatedRequest(...args)

  const lazyCall = (op) => (...args) => {
    let call = callUnsigned
    if (cfg.mode === 'LOCAL') {
      call = callDirect
    } else if (authenticated) {
      if (
        // sign if operation is not bucket-specific
        // (not sure if there are any such operations that can be used from the browser)
        !args[0].Bucket ||
        (cfg.analyticsBucket && cfg.analyticsBucket === args[0].Bucket) ||
        (cfg.mode !== 'OPEN' && isInStack(args[0].Bucket))
      ) {
        call = callDirect
      }
    } else if (SELECT_METHODS.include(op)) {
      call = callSelect
    }
    return call(op, ...args)
  }

  const proxyProp = (getInstance, prop, receiver) => {
    const inst = getInstance()
    const value = Reflect.get(inst, prop, receiver)
    return typeof value === 'function' ? value.bind(inst) : value
  }

  const client = useConstant(
    () =>
      new Proxy(
        {},
        {
          get(target, prop, receiver) {
            if (PROXY_METHODS.includes(prop) || SELECT_METHODS.includes(prop)) {
              return lazyCall(prop)
            }
            if (SIGN_METHODS.includes(prop)) {
              return proxyProp(getSigningClient, prop, receiver)
            }
            return proxyProp(getProxyingClient, prop, receiver)
          },
          set(target, ...rest) {
            return Reflect.set(getProxyingClient(), ...rest)
          },
        },
      ),
  )

  return <Ctx.Provider value={client}>{children}</Ctx.Provider>
}

export function useS3() {
  Credentials.use().suspend()
  return React.useContext(Ctx)
}

export const use = useS3

export function InjectS3({ children }) {
  return children(useS3())
}

export const Inject = InjectS3
