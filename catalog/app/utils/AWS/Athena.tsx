import Athena from 'aws-sdk/clients/athena'
import * as React from 'react'

import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'

const AthenaContext = React.createContext<() => Athena | null>(() => null)

type AthenaProviderProps = {
  children: React.ReactNode
  overrides?: Partial<Athena.ClientConfiguration>
}

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

export function useAthena() {
  const athena = React.useContext(AthenaContext)
  return athena ? athena() : null
}

export const use = useAthena
