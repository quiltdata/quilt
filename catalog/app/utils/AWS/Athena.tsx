import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'

const AthenaContext = React.createContext<() => Athena | null>(() => null)

type AthenaProviderProps = React.PropsWithChildren<Partial<Athena.ClientConfiguration>>

export const Provider = function AthenaProvider({
  children,
  ...overrides
}: AthenaProviderProps) {
  const cfg = Config.use()

  const client: () => Athena = useMemoEqLazy(
    {
      ...cfg,
      ...overrides,
    },
    (opts: Athena.ClientConfiguration) => new Athena(opts),
  )

  return <AthenaContext.Provider value={client}>{children}</AthenaContext.Provider>
}

export const useAthena = () => {
  Credentials.use().suspend()
  React.useContext(AthenaContext)()
}

export const use = useAthena
