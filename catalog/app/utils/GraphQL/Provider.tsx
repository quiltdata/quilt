import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import * as urql from 'urql'
import customScalarsExchange from 'urql-custom-scalars-exchange'
import * as DevTools from '@urql/devtools'
import * as GraphCache from '@urql/exchange-graphcache'

import cfg from 'constants/config'
import * as AuthSelectors from 'containers/Auth/selectors'
import { useAuthExchange } from 'containers/Auth/urqlExchange'
import schema from 'model/graphql/schema.generated'

const devtools = process.env.NODE_ENV === 'development' ? [DevTools.devtoolsExchange] : []

const BUCKET_CONFIGS_QUERY = urql.gql`{ bucketConfigs { name } }`
const BUCKETS_QUERY = urql.gql`{ buckets { name } }`
const POLICIES_QUERY = urql.gql`{ policies { id } }`
const ROLES_QUERY = urql.gql`{ roles { id } }`
const USERS_QUERY = urql.gql`{ admin { user { list { name } } } }`
const DEFAULT_ROLE_QUERY = urql.gql`{ defaultRole { id } }`

// Invalidate all cached variants of a root Query field (args-aware).
// Marks cached variants stale so the next read refetches; does NOT
// reliably notify active subscribers on urql 2.x + graphcache 4.x.
// Use refetchRootField when a subscriber must see the new data
// without re-navigation.
function invalidateRootField(cache: GraphCache.Cache, fieldName: string) {
  for (const f of cache.inspectFields('Query')) {
    if (f.fieldName === fieldName) {
      cache.invalidate('Query', f.fieldName, f.arguments || undefined)
    }
  }
}

type RootQueryDoc = urql.TypedDocumentNode<unknown, Record<string, never>>

// Force a fresh fetch of a root-level query through the supplied client
// and let urql propagate the new data to all active subscribers. Use
// when the post-mutation result can't be predicted client-side (e.g. a
// role-policy edit that shifts which buckets fall into the caller's
// scope). `cache.invalidate` on a root field is unreliable at notifying
// active subscribers in urql 2.x + @urql/exchange-graphcache 4.x; a
// `network-only` query reliably writes back through the cache exchange
// and fans out. The microtask defer lets the current mutation's cache
// write commit first.
function refetchRootField(clientRef: React.RefObject<urql.Client>, query: RootQueryDoc) {
  Promise.resolve().then(() => {
    clientRef.current
      ?.query(query, {}, { requestPolicy: 'network-only' })
      .toPromise()
      .catch(() => {}) // fire-and-forget: urql surfaces errors via result.error, not rejection
  })
}

function handlePackageCreation(result: any, cache: GraphCache.Cache) {
  if (result.__typename !== 'PackagePushSuccess') return
  const { bucket, name } = result.package
  const revList = cache.resolve({ __typename: 'Package', bucket, name }, 'revisions')
  for (let f of cache.inspectFields(revList as GraphCache.Entity)) {
    // Fresh data for pages 1–5 and 1–30 is in the mutation result; keep those.
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
  invalidateRootField(cache, 'packages')
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

export default function GraphQLProvider({ children }: React.PropsWithChildren<{}>) {
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

  // Forward-reference to the urql client so mutation `updates` handlers
  // below can reach it without threading it through Graphcache's API.
  // Assigned after `createClient` further down; reads are deferred to
  // a microtask inside `refetchRootField`, so it's populated by then.
  const clientRef = React.useRef<urql.Client | null>(null)

  const cacheExchange = React.useMemo(
    () => {
      const refetchBuckets = () => refetchRootField(clientRef, BUCKETS_QUERY)
      return GraphCache.cacheExchange({
        schema,
        keys: {
          AccessCountForDate: () => null,
          AccessCounts: () => null,
          AccessCountsGroup: () => null,
          AdminMutations: () => null,
          AdminQueries: () => null,
          BooleanPackageUserMetaFacet: () => null,
          BucketAccessCounts: () => null,
          Bucket: (b) => b.name as string,
          BucketConfig: (b) => b.name as string,
          Canary: (c) => c.name as string,
          Collaborator: (c) => c.username as string,
          Config: () => null,
          ContentIndexingSettings: () => null,
          DatetimeExtents: () => null,
          DatetimePackageUserMetaFacet: () => null,
          EmptySearchResultSet: () => null,
          InputError: () => null,
          InvalidInput: () => null,
          KeywordExtents: () => null,
          KeywordPackageUserMetaFacet: () => null,
          Me: (me) => me.name as string,
          MutateUserAdminMutations: () => null,
          MyRole: (r) => r.name as string,
          NumberExtents: () => null,
          NumberPackageUserMetaFacet: () => null,
          ObjectsSearchResultSet: () => null,
          ObjectsSearchResultSetPage: () => null,
          ObjectsSearchStats: () => null,
          Package: (p) => (p.bucket && p.name ? `${p.bucket}/${p.name}` : null),
          PackageDir: () => null,
          PackageFile: () => null,
          PackageList: () => null,
          PackageRevision: (r) =>
            r.hash ? `${r.hash}:${r.modified?.valueOf() || ''}` : null, // XXX: is r.modified a string here?
          PackageRevisionList: () => null,
          PackageWorkflow: () => null,
          PackagerAdminMutations: () => null,
          PackagerAdminQueries: () => null,
          PackagerEventRule: (r) => r.name as string,
          PackagesSearchResultSet: () => null,
          PackagesSearchResultSetPage: () => null,
          PackagesSearchStats: () => null,
          PolicyBucketPermission: (p: any) =>
            p.bucket?.name && p.policy?.id ? `${p.bucket.name}/${p.policy.id}` : null,
          RoleBucketPermission: (p: any) =>
            p.bucket?.name && p.role?.id ? `${p.bucket.name}/${p.role.id}` : null,
          SearchHitPackage: () => null,
          SearchHitPackageEntryMatchLocations: () => null,
          SearchHitPackageMatchLocations: () => null,
          SearchHitPackageMatchingEntry: () => null,
          SsoConfig: (c) =>
            c.timestamp instanceof Date ? c.timestamp.getTime().toString() : null,
          Status: () => null,
          StatusReport: (r) => (typeof r.timestamp === 'string' ? r.timestamp : null),
          StatusReportList: () => null,
          SubscriptionState: () => null,
          TabulatorTable: (t) => t.name as string,
          TestStats: () => null,
          TestStatsTimeSeries: () => null,
          TextPackageUserMetaFacet: () => null,
          Unavailable: () => null,
          User: (u) => (u.name as string) ?? null,
          UserAdminMutations: () => null,
          UserAdminQueries: () => null,
        },
        updates: {
          Mutation: {
            // Admin UI reads `bucketConfigs` (all buckets); user-facing
            // code reads `buckets` (role-scoped). The two lists coexist —
            // Bucket and BucketConfig are separate __typenames keyed by
            // name — so each bucketAdd/Remove updates the admin list and
            // nudges the role-scoped list.
            bucketAdd: (result, _vars, cache) => {
              if ((result.bucketAdd as any)?.__typename !== 'BucketAddSuccess') return
              cache.updateQuery(
                { query: BUCKET_CONFIGS_QUERY },
                // XXX: sort?
                R.evolve({
                  bucketConfigs: R.append((result.bucketAdd as any).bucketConfig),
                }),
              )
              // Query.buckets unchanged: a new bucket has no policy
              // attachments yet, so no managed-role user's set changes.
            },
            bucketUpdate: (result, vars, cache) => {
              if ((result.bucketUpdate as any)?.__typename !== 'BucketUpdateSuccess')
                return
              // The mutation result updates BucketConfig; Bucket (same
              // name, different __typename) won't auto-propagate.
              cache.invalidate({ __typename: 'Bucket', name: vars.name })
            },
            bucketRemove: (result, vars, cache) => {
              if ((result.bucketRemove as any)?.__typename !== 'BucketRemoveSuccess')
                return
              cache.updateQuery(
                { query: BUCKET_CONFIGS_QUERY },
                R.evolve({ bucketConfigs: R.reject(R.propEq('name', vars.name)) }),
              )
              cache.updateQuery(
                { query: BUCKETS_QUERY },
                R.evolve({ buckets: R.reject(R.propEq('name', vars.name)) }),
              )
              cache.invalidate({ __typename: 'Bucket', name: vars.name })
              // Server cascade-deletes the PolicyBucketPermission /
              // RoleBucketPermission rows for the removed bucket, but the
              // cached entries (keyed {bucketName}/{id}) are not reachable
              // via the Bucket-entity invalidation above — strip them from
              // every cached Policy.permissions and ManagedRole.permissions
              // array.
              const stripBucket = R.reject(R.pathEq(['bucket', 'name'], vars.name))
              cache.updateQuery(
                {
                  query: urql.gql`{ policies { id permissions { bucket { name } } } }`,
                },
                R.evolve({
                  policies: R.map(R.evolve({ permissions: stripBucket })),
                }),
              )
              cache.updateQuery(
                {
                  query: urql.gql`{ roles { id ... on ManagedRole { permissions { bucket { name } } } } }`,
                },
                R.evolve({
                  roles: R.map(R.evolve({ permissions: stripBucket })),
                }),
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
              refetchBuckets()
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
              refetchBuckets()
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

              refetchBuckets()
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
              refetchBuckets()
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
                R.unless(
                  R.isNil,
                  R.evolve({
                    bucketConfigs: R.map(
                      R.evolve({
                        associatedRoles: R.reject(R.pathEq(['role', 'id'], vars.id)),
                      }),
                    ),
                  }),
                ),
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

              refetchBuckets()
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
            admin: (result: any, _vars, cache, info) => {
              // XXX: newer versions of GraphCache support updaters on arbitrary types
              if (result.admin?.user?.create?.__typename === 'User') {
                // Add created User to user list
                // XXX: sort?
                const addUser = R.append(result.admin.user.create)
                cache.updateQuery(
                  { query: USERS_QUERY },
                  R.evolve({ admin: { user: { list: addUser } } }),
                )
              }
              if (result.admin?.user?.mutate?.delete?.__typename === 'Ok') {
                // XXX: handle "user not found" somehow?
                // Remove deleted User from user list
                const rmUser = R.reject(R.propEq('name', info.variables.name))
                cache.updateQuery(
                  { query: USERS_QUERY },
                  R.evolve({ admin: { user: { list: rmUser } } }),
                )
              }
              if (
                result.admin?.setSsoConfig?.__typename === 'SsoConfig' ||
                result.admin?.setSsoConfig === null
              ) {
                cache.invalidate({ __typename: 'Query' }, 'admin')
                cache.invalidate({ __typename: 'Query' }, 'roles')
              }
              if (result.admin?.user?.mutate?.setRole?.__typename === 'User') {
                // Over-invalidates when the edit targets another user;
                // acceptable for a rare admin op, avoids a self-check
                // against the current session user.
                refetchBuckets()
              }
              if (result.admin?.setTabulatorOpenQuery?.tabulatorOpenQuery != null) {
                cache.updateQuery(
                  { query: urql.gql`{ admin { tabulatorOpenQuery } }` },
                  ({ admin }) => ({
                    admin: {
                      ...admin,
                      tabulatorOpenQuery:
                        result.admin.setTabulatorOpenQuery.tabulatorOpenQuery,
                    },
                  }),
                )
              }
            },
          },
        },
        // XXX: make an exchange for handling optimistic responses
        optimistic: {
          bucketRemove: () => ({ __typename: 'BucketRemoveSuccess' }),
          roleDelete: () => ({ __typename: 'RoleDeleteSuccess' }),
          roleSetDefault: ({ id }) => ({
            __typename: 'RoleSetDefaultSuccess',
            role: { __typename: 'ManagedRole', id },
          }),
        },
      })
    },
    [sessionId], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const client = React.useMemo(
    () =>
      urql.createClient({
        url: `${cfg.registryUrl}/graphql`,
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
    [authExchange, cacheExchange, scalarsExchange],
  )
  clientRef.current = client
  return <urql.Provider value={client}>{children}</urql.Provider>
}

// Possibly useful exchanges:
// errorExchange: Allows a global callback to be called when any error occurs
// retryExchange: Allows operations to be retried
// requestPolicyExchange: Automatically upgrades cache-only and cache-first operations to cache-and-network after a given amount of time.
// refocusExchange: Tracks open queries and refetches them when the window regains focus.
