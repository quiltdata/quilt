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
const POLICIES_QUERY = urql.gql`{ policies { id } }`
const ROLES_QUERY = urql.gql`{ roles { id } }`
const DEFAULT_ROLE_QUERY = urql.gql`{ defaultRole { id } }`

function handlePackageCreation(result: any, cache: GraphCache.Cache) {
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

function invalidateAffectedRoles(policy: any, cache: GraphCache.Cache) {
  if (!policy.roles) return
  const roleIds = R.pluck('id', policy.roles as { id: string }[])
  const rolesData = cache.readQuery({
    query: urql.gql`{ roles { id ... on ManagedRole { policies { id } } } }`,
  })
  for (let role of rolesData?.roles || []) {
    if (!role.policies) continue
    const hasThisPolicy = !!role.policies.find(R.propEq('id', policy.id))
    const shouldHaveThisPolicy = roleIds.includes(role.id)
    if (hasThisPolicy === shouldHaveThisPolicy) continue
    cache.invalidate(role, 'policies')
    cache.invalidate(role, 'permissions')
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
          PolicyBucketPermission: (p: any) =>
            p.bucket?.name && p.policy?.id ? `${p.bucket.name}/${p.policy.id}` : null,
          RoleBucketPermission: (p: any) =>
            p.bucket?.name && p.role?.id ? `${p.bucket.name}/${p.role.id}` : null,
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
            policyCreateManaged: (result, _vars, cache) => {
              const policy = result.policyCreateManaged as any
              if (policy?.__typename !== 'Policy') return
              cache.updateQuery(
                { query: POLICIES_QUERY },
                // XXX: sort?
                R.evolve({ policies: R.append(policy) }),
              )
            },
            policyCreateUnmanaged: (result, _vars, cache) => {
              const policy = result.policyCreateUnmanaged as any
              if (policy?.__typename !== 'Policy') return
              cache.updateQuery(
                { query: POLICIES_QUERY },
                // XXX: sort?
                R.evolve({ policies: R.append(policy) }),
              )
            },
            policyUpdateManaged: (result, _vars, cache) => {
              const policy = result.policyUpdateManaged as any
              if (policy?.__typename !== 'Policy') return
              invalidateAffectedRoles(policy, cache)
              // XXX: same with BucketConfigs?
            },
            policyUpdateUnmanaged: (result, _vars, cache) => {
              const policy = result.policyUpdateUnmanaged as any
              if (policy?.__typename !== 'Policy') return
              invalidateAffectedRoles(policy, cache)
            },
            policyDelete: (result, vars, cache) => {
              const typename = (result.policyDelete as any)?.__typename
              if (typename !== 'Ok') return

              // Remove deleted Policy from root policies
              cache.updateQuery(
                { query: POLICIES_QUERY },
                R.evolve({ policies: R.reject(R.propEq('id', vars.id)) }),
              )

              // Remove deleted Policy from every ManagedRole's policies
              // (probably not necessary since we disallow removing attached policies)
              cache.updateQuery(
                {
                  query: urql.gql`{ roles { id ... on ManagedRole { policies { id } } } }`,
                },
                R.evolve({
                  roles: R.map(R.evolve({ policies: R.reject(R.propEq('id', vars.id)) })),
                }),
              )
            },
            roleCreateManaged: (result, _vars, cache) => {
              const create = result.roleCreateManaged as any
              if (create?.__typename !== 'RoleCreateSuccess') return
              // Add created Role to root roles
              cache.updateQuery(
                { query: ROLES_QUERY },
                // XXX: sort?
                R.evolve({ roles: R.append(create.role) }),
              )
            },
            roleCreateUnmanaged: (result, _vars, cache) => {
              const create = result.roleCreateUnmanaged as any
              if (create?.__typename !== 'RoleCreateSuccess') return
              // Add created Role to root roles
              cache.updateQuery(
                { query: ROLES_QUERY },
                // XXX: sort?
                R.evolve({ roles: R.append(create.role) }),
              )
            },
            roleUpdateManaged: (result, _vars, cache) => {
              const update = result.roleUpdateManaged as any
              if (update?.__typename !== 'RoleUpdateSuccess') return
              const { role } = update
              if (!role.policies) return
              const policyIds = R.pluck('id', role.policies as { id: string }[])
              cache.updateQuery(
                { query: urql.gql`{ policies { id roles { id } } }` },
                R.evolve({
                  policies: R.map((policy: any) => {
                    if (!policy.roles) return policy
                    const hasThisRole = !!policy.roles.find(R.propEq('id', role.id))
                    const shouldHaveThisRole = policyIds.includes(policy.id)
                    if (hasThisRole === shouldHaveThisRole) return policy
                    return {
                      ...policy,
                      roles: shouldHaveThisRole
                        ? [...policy.roles, role]
                        : policy.roles.filter((r: any) => r.id !== role.id),
                    }
                  }),
                }),
              )
            },
            roleDelete: (result, vars, cache) => {
              const typename = (result.roleDelete as any)?.__typename
              if (typename !== 'RoleDeleteSuccess' && typename !== 'RoleDoesNotExist')
                return

              // Remove deleted Role from every Policy's roles
              cache.updateQuery(
                { query: urql.gql`{ policies { id roles { id } } }` },
                R.evolve({
                  policies: R.map(R.evolve({ roles: R.reject(R.propEq('id', vars.id)) })),
                }),
              )

              // Remove deleted Role from every BucketConfig's associatedRoles
              cache.updateQuery(
                {
                  query: urql.gql`{ bucketConfigs { name associatedRoles { role { id } bucket { name } } } }`,
                },
                R.evolve({
                  bucketConfigs: R.map(
                    R.evolve({
                      associatedRoles: R.reject(R.pathEq(['role', 'id'], vars.id)),
                    }),
                  ),
                }),
              )

              // Remove deleted Role from root roles
              cache.updateQuery(
                { query: ROLES_QUERY },
                R.evolve({ roles: R.reject(R.propEq('id', vars.id)) }),
              )

              // Unset default Role if it was deleted
              cache.updateQuery({ query: DEFAULT_ROLE_QUERY }, (data) =>
                data.defaultRole?.id === vars.id ? { defaultRole: null } : data,
              )
            },
            roleSetDefault: (result, _vars, cache) => {
              const typename = (result.roleSetDefault as any)?.__typename
              if (typename !== 'RoleSetDefaultSuccess') return
              const { role } = result.roleSetDefault as any
              cache.updateQuery({ query: DEFAULT_ROLE_QUERY }, () => ({
                defaultRole: { __typename: role.__typename, id: role.id },
              }))
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
