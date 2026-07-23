import * as React from 'react'

import useMemoEq from 'utils/useMemoEq'

import * as Credentials from './Credentials'

const Ctx = React.createContext()

// aws-sdk v3 has no `AWS.Config` aggregate object; each client takes a plain
// config object in its constructor. We build that object here: the credentials
// provider (an `AwsCredentialIdentityProvider`) plus any caller-supplied props.
const useConfig = (props) => {
  const credentials = Credentials.use()
  return useMemoEq({ credentials: credentials.provider, ...props }, (input) => input)
}

export function Provider({ children, ...props }) {
  return <Ctx.Provider value={props}>{children}</Ctx.Provider>
}

const useAll = () => useConfig(React.useContext(Ctx))

export const use = useAll
