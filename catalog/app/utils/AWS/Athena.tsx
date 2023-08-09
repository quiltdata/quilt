import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import cfg from 'constants/config'
import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'

const region = cfg.defaultRegion

const AthenaContext = React.createContext<() => Athena | null>(() => null)

type AthenaProviderProps = React.PropsWithChildren<Partial<Athena.ClientConfiguration>>

export const Provider = function AthenaProvider({
  children,
  ...overrides
}: AthenaProviderProps) {
  const awsConfig = Config.use()

  const client: () => Athena = useMemoEqLazy(
    {
      ...awsConfig,
      region,
      ...overrides,
    },
    (opts: Athena.ClientConfiguration) => new Athena(opts),
  )

  return <AthenaContext.Provider value={client}>{children}</AthenaContext.Provider>
}

export const useAthena = () => {
  Credentials.use().suspend()
  return React.useContext(AthenaContext)()
}

export const use = useAthena
