import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'
import customScalarsExchange from 'urql-custom-scalars-exchange'
import * as DevTools from '@urql/devtools'
import * as GraphCache from '@urql/exchange-graphcache'

import schema from 'model/graphql/schema.generated'
import * as AuthSelectors from 'containers/Auth/selectors'
import { useAuthExchange } from 'containers/Auth/urqlExchange'
import * as Config from 'utils/Config'

const devtools = process.env.NODE_ENV === 'development' ? [DevTools.devtoolsExchange] : []

const BUCKET_CONFIGS_QUERY = urql.gql`{ bucketConfigs { name } }`

export function GraphQLProvider({ children }: React.PropsWithChildren<{}>) {
  const { registryUrl } = Config.use()
  const url = `${registryUrl}/graphql`

  const sessionId: number = redux.useSelector(AuthSelectors.sessionId)

  const authExchange = useAuthExchange()

  const scalarsExchange = React.useMemo(
    () =>
      customScalarsExchange({
        schema,
        scalars: {
          Datetime(value) {
            return new Date(value)
          },
        },
      }),
    [],
  )

  const cacheExchange = React.useMemo(
    () =>
      GraphCache.cacheExchange({
        schema,
        keys: {
          BucketConfig: (b) => b.name as string,
        },
        updates: {
          Mutation: {
            bucketAdd: (result, _vars, cache) => {
              if ((result.bucketAdd as any)?.__typename !== 'BucketAddSuccess') return
              cache.updateQuery(
                { query: BUCKET_CONFIGS_QUERY },
                // XXX: sort?
                R.evolve({
                  bucketConfigs: R.append((result.bucketAdd as any).bucketConfig),
                }),
              )
            },
            bucketRemove: (result, vars, cache) => {
              if ((result.bucketRemove as any)?.__typename !== 'BucketRemoveSuccess')
                return
              cache.updateQuery(
                { query: BUCKET_CONFIGS_QUERY },
                R.evolve({ bucketConfigs: R.reject(R.propEq('name', vars.name)) }),
              )
            },
          },
        },
        optimistic: {
          bucketRemove: () => ({ __typename: 'BucketRemoveSuccess' }),
        },
      }),
    [sessionId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const client = React.useMemo(
    () =>
      urql.createClient({
        url,
        suspense: true,
        exchanges: [
          ...devtools,
          urql.dedupExchange,
          scalarsExchange,
          cacheExchange,
          authExchange,
          urql.fetchExchange,
        ],
      }),
    [url, authExchange, cacheExchange, scalarsExchange],
  )
  return <urql.Provider value={client}>{children}</urql.Provider>
}

// Possibly useful exchanges:
// errorExchange: Allows a global callback to be called when any error occurs
// retryExchange: Allows operations to be retried
// requestPolicyExchange: Automatically upgrades cache-only and cache-first operations to cache-and-network after a given amount of time.
// refocusExchange: Tracks open queries and refetches them when the window regains focus.
