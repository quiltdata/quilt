import S3 from 'aws-sdk/clients/s3'
import * as React from 'react'
import * as reduxHook from 'redux-react-hook'

import * as Auth from 'containers/Auth'
import { useConfig } from 'utils/Config'
import * as RT from 'utils/reactTools'
import useMemoEq from 'utils/useMemoEq'

import * as Config from './Config'
import * as Credentials from './Credentials'

const DEFAULT_OPTS = {
  signatureVersion: 'v4',
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

export const useS3 = (extra) => {
  const config = Config.use()
  Credentials.use().suspend()
  const props = React.useContext(Ctx)
  // TODO: use cache?
  return useMemoEq({ ...config, ...props, ...extra }, (cfg) => new S3(cfg))
}

export const use = useS3

export const useRequest = (extra) => {
  const cfg = useConfig()
  const s3RegularClient = useS3(extra)
  const s3ProxiyngClient = useS3({
    endpoint: cfg.s3Proxy,
    s3ForcePathStyle: true,
    ...extra,
  })
  const authenticated = reduxHook.useMappedState(Auth.selectors.authenticated)
  return React.useMemo(
    () => ({ bucket, operation, params }) => {
      const useProxy = bucket !== cfg.defaultBucket
      const client = useProxy ? s3ProxiyngClient : s3RegularClient
      const method =
        authenticated && !useProxy ? 'makeRequest' : 'makeUnauthenticatedRequest'
      return client[method](operation, params).promise()
    },
    [s3RegularClient, s3ProxiyngClient, authenticated, cfg.defaultBucket],
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
