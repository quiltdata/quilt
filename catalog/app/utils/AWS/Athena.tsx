import Athena from 'aws-sdk/clients/athena'
import * as R from 'ramda'
import * as React from 'react'

import * as CatalogConfig from 'utils/Config'
import useMemoEqLazy from 'utils/useMemoEqLazy'

import * as Config from './Config'
import * as Credentials from './Credentials'

const getRegion: (input: string) => string = R.pipe(
  R.match(/\.([a-z]{2}-[a-z]+-\d)\.amazonaws\.com/),
  R.nth(1),
  R.defaultTo('us-east-1'),
)

const AthenaContext = React.createContext<() => Athena | null>(() => null)

type AthenaProviderProps = React.PropsWithChildren<Partial<Athena.ClientConfiguration>>

export const Provider = function AthenaProvider({
  children,
  ...overrides
}: AthenaProviderProps) {
  const awsConfig = Config.use()
  const catalogConfig = CatalogConfig.use()

  const region = React.useMemo(() => getRegion(catalogConfig.apiGatewayEndpoint), [
    catalogConfig,
  ])

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
