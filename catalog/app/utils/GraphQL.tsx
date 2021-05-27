import * as React from 'react'
import * as Urql from 'urql'
import * as DevTools from '@urql/devtools'
import * as GraphCache from '@urql/exchange-graphcache'

import { useAuthExchange, useAuthErrorExchange } from 'containers/Auth/urqlExchange'
import * as Config from 'utils/Config'

const devtools = process.env.NODE_ENV === 'development' ? [DevTools.devtoolsExchange] : []

export function GraphQLProvider({ children }: React.PropsWithChildren<{}>) {
  const { registryUrl } = Config.use()
  const url = `${registryUrl}/graphql`

  const authErrorExchange = useAuthErrorExchange()
  const authExchange = useAuthExchange()

  const client = React.useMemo(
    () =>
      Urql.createClient({
        url,
        suspense: true,
        exchanges: [
          ...devtools,
          Urql.dedupExchange,
          GraphCache.cacheExchange({
            // schema: TODO: get introspected schema
            keys: {
              Bucket: (b) => b.name as string,
              BucketConfig: () => null,
            },
          }),
          authErrorExchange,
          authExchange,
          Urql.fetchExchange,
        ],
      }),
    [url, authErrorExchange, authExchange],
  )
  return <Urql.Provider value={client}>{children}</Urql.Provider>
}

// errorExchange: Allows a global callback to be called when any error occurs
// retryExchange: Allows operations to be retried
// requestPolicyExchange: Automatically upgrades cache-only and cache-first operations to cache-and-network after a given amount of time.
// refocusExchange: Tracks open queries and refetches them when the window regains focus.
