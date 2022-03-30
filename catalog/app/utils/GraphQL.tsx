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
const ROLES_QUERY = urql.gql`{ roles { id } }`
const DEFAULT_ROLE_QUERY = urql.gql`{ defaultRole { id } }`

const handlePackageCreation = (result: any, cache: GraphCache.Cache) => {
  if (result.__typename !== 'PackagePushSuccess') return
  const { bucket, name } = result.package
  const revList = cache.resolve({ __typename: 'Package', bucket, name }, 'revisions')
  for (let f of cache.inspectFields(revList as GraphCache.Entity)) {
    // Invalidate all the outdated cached pages.
    // Fresh data for pages 1-5 and 1-30 are contained in the mutation result,
    // so we're keeping them.
    if (
      f.fieldName == 'page' &&
      (f.arguments?.number !== 1 ||
        (f.arguments?.perPage !== 5 && f.arguments?.perPage !== 30))
    ) {
      cache.invalidate(revList as GraphCache.Entity, f.fieldKey)
    }
  }
  cache.link(
    'Query',
    'package',
    { bucket, name },
    { __typename: 'Package', bucket, name },
  )
  for (let f of cache.inspectFields('Query')) {
    // Invalidate all package lists.
    if (f.fieldName == 'packages') {
      cache.invalidate('Query', f.fieldKey)
    }
  }
}

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
          AccessCountForDate: () => null,
          AccessCounts: () => null,
          BucketConfig: (b) => b.name as string,
          Config: () => null,
          ContentIndexingSettings: () => null,
          Package: (p) => (p.bucket && p.name ? `${p.bucket}/${p.name}` : null),
          PackageDir: () => null,
          PackageFile: () => null,
          PackageList: () => null,
          PackageRevision: (r) =>
            r.hash ? `${r.hash}:${r.modified?.valueOf() || ''}` : null,
          PackageRevisionList: () => null,
          PackageWorkflow: () => null,
          RoleBucketPermission: () => null,
        },
        updates: {
          Mutation: {
            bucketAdd: (result, _vars, cache) => {
              if ((result.bucketAdd as any)?.__typename !== 'BucketAddSuccess') return
              cache.invalidate({ __typename: 'Query' }, 'roles')
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
              cache.invalidate({ __typename: 'Query' }, 'roles')
              cache.updateQuery(
                { query: BUCKET_CONFIGS_QUERY },
                R.evolve({ bucketConfigs: R.reject(R.propEq('name', vars.name)) }),
              )
            },
            roleCreateManaged: (result, _vars, cache) => {
              if ((result.roleCreateManaged as any)?.__typename !== 'RoleCreateSuccess')
                return
              cache.updateQuery(
                { query: ROLES_QUERY },
                // XXX: sort?
                R.evolve({ roles: R.append((result.roleCreateManaged as any).role) }),
              )
            },
            roleCreateUnmanaged: (result, _vars, cache) => {
              if ((result.roleCreateUnmanaged as any)?.__typename !== 'RoleCreateSuccess')
                return
              cache.updateQuery(
                { query: ROLES_QUERY },
                // XXX: sort?
                R.evolve({ roles: R.append((result.roleCreateUnmanaged as any).role) }),
              )
            },
            roleDelete: (result, vars, cache) => {
              const typename = (result.roleDelete as any)?.__typename
              if (typename === 'RoleDeleteSuccess' || typename === 'RoleDoesNotExist') {
                cache.updateQuery(
                  { query: ROLES_QUERY },
                  R.evolve({ roles: R.reject(R.propEq('id', vars.id)) }),
                )
                cache.updateQuery({ query: DEFAULT_ROLE_QUERY }, (data) =>
                  data.defaultRole?.id === vars.id ? { defaultRole: null } : data,
                )
              }
            },
            roleSetDefault: (result, _vars, cache) => {
              const typename = (result.roleSetDefault as any)?.__typename
              if (typename === 'RoleSetDefaultSuccess') {
                const { role } = result.roleSetDefault as any
                cache.updateQuery({ query: DEFAULT_ROLE_QUERY }, () => ({
                  defaultRole: { __typename: role.__typename, id: role.id },
                }))
              }
            },
            packageRevisionDelete: (result, { bucket, name, hash }, cache) => {
              const del = result.packageRevisionDelete as any
              if (del.__typename !== 'PackageRevisionDeleteSuccess') return
              cache.invalidate({ __typename: 'PackageRevision', hash })
              cache.invalidate({ __typename: 'Package', bucket, name }, 'revisions')
            },
            packageConstruct: (result, _vars, cache) => {
              handlePackageCreation(result.packageConstruct, cache)
            },
            packagePromote: (result, _vars, cache) => {
              handlePackageCreation(result.packagePromote, cache)
            },
            packageFromFolder: (result, _vars, cache) => {
              handlePackageCreation(result.packageFromFolder, cache)
            },
          },
        },
        optimistic: {
          bucketRemove: () => ({ __typename: 'BucketRemoveSuccess' }),
          roleDelete: () => ({ __typename: 'RoleDeleteSuccess' }),
          roleSetDefault: ({ id }) => ({
            __typename: 'RoleSetDefaultSuccess',
            role: { __typename: 'ManagedRole', id },
          }),
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
