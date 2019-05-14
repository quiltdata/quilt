import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/config'
import * as React from 'react'

import * as RT from 'utils/reactTools'
import useMemoEq from 'utils/useMemoEq'

import * as Credentials from './Credentials'

const Ctx = React.createContext()

const useConfig = (props) => {
  const credentials = Credentials.use()
  // TODO: use cache?
  return useMemoEq({ credentials, ...props }, (input) => new AWS.Config(input))
}

export const Provider = RT.composeComponent(
  'AWS.Config.Provider',
  ({ children, ...props }) => <Ctx.Provider value={props}>{children}</Ctx.Provider>,
)

const useAll = () => useConfig(React.useContext(Ctx))

export const use = useAll

export const inject = (prop = 'awsConfig') =>
  RT.composeHOC('AWS.Config.inject', (Component) => (props) => {
    const config = use()
    return <Component {...{ [prop]: config, ...props }} />
  })
