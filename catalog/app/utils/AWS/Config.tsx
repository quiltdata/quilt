import AWS from 'aws-sdk/lib/core'
import 'aws-sdk/lib/config'
import * as React from 'react'

import useMemoEq from 'utils/useMemoEq'

import * as Credentials from './Credentials'

const Ctx = React.createContext<AWS.ConfigurationOptions | undefined>(undefined)

const useConfig = (props: AWS.ConfigurationOptions | undefined) => {
  const credentials = Credentials.use()
  // TODO: use cache?
  return useMemoEq({ credentials, ...props }, (input) => new AWS.Config(input))
}

type ProviderProps = React.PropsWithChildren<AWS.ConfigurationOptions>

export function Provider({ children, ...props }: ProviderProps) {
  return <Ctx.Provider value={props}>{children}</Ctx.Provider>
}

const useAll = () => useConfig(React.useContext(Ctx))

export const use = useAll
