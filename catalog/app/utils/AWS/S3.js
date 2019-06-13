import S3 from 'aws-sdk/clients/s3'
import * as React from 'react'

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
  // TODO: do this via config.json, update json-schema
  config.endpoint = 'https://open-proxy.quiltdata.com'
  config.s3ForcePathStyle = true
  Credentials.use().suspend()
  const props = React.useContext(Ctx)
  // TODO: use cache?
  return useMemoEq({ ...config, ...props, ...extra }, (cfg) => new S3(cfg))
}

export const use = useS3

export const inject = (prop = 's3') =>
  RT.composeHOC('AWS.S3.inject', (Component) => (props) => {
    const s3 = use()
    return <Component {...{ [prop]: s3, ...props }} />
  })

export const Inject = ({ children }) => children(use())
