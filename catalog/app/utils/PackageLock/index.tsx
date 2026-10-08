import * as React from 'react'
import type * as urql from 'urql'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as GQL from 'utils/GraphQL'

import LOCK_QUERY from './gql/Lock.generated'
import LOCK_STATE_QUERY from './gql/LockState.generated'

export type Status = 'loading' | 'locked' | 'unlocked'

interface Result {
  operation?: urql.Operation
  data?: { package: { bucket: string; name: string; lock: unknown } | null }
  error?: unknown
  fetching?: boolean
  stale?: boolean
}

const currentPackage = ({ data }: Result, bucket: string, name: string) => {
  const pkg = data?.package
  // urql keeps the previous variables' data while the next request is in flight.
  return pkg && pkg.bucket === bucket && pkg.name === name ? pkg : null
}

// A query error, including a registry without the lock field, reads as unlocked: the
// registry still refuses writes to a locked package.
function toStatus(result: Result, bucket: string, name: string, pause: boolean): Status {
  if (pause) return 'unlocked'
  const { data, error, fetching } = result
  const pkg = currentPackage(result, bucket, name)
  if (pkg?.lock) return 'locked'
  // Graphcache answers an uncached `lock` with null when another query cached the package.
  const known = !GQL.isPartial(result) && !!data && (!data.package || !!pkg)
  // Known data keeps its status while it refetches; only unknown data waits.
  if (fetching && !known) return 'loading'
  if (error) return 'unlocked'
  return known ? 'unlocked' : 'loading'
}

// Its own query, so a registry without locks fails only this one.
export function useLock(bucket: string, name: string, pause = false) {
  const result = GQL.useQuery(LOCK_QUERY, { bucket, name }, { pause })
  const { run } = result
  const refresh = React.useCallback(() => run({ requestPolicy: 'network-only' }), [run])
  const status = toStatus(result, bucket, name, pause)
  return {
    status,
    lock: status === 'locked' ? (result.data?.package?.lock ?? null) : null,
    latestHash: currentPackage(result, bucket, name)
      ? result.data?.package?.latest?.hash
      : undefined,
    refresh,
  }
}

// Lock only, for checks that run per typed name.
export function useLockStatus(bucket: string, name: string, pause = false): Status {
  const result = GQL.useQuery(LOCK_STATE_QUERY, { bucket, name }, { pause })
  return toStatus(result, bucket, name, pause)
}

// Only a package known unlocked can be locked, never one whose lock is still loading.
export const canLock = (isAdmin: boolean, status: Status, latestHash?: string) =>
  isAdmin && status === 'unlocked' && !!latestHash

const LOCKED_ACTIONS = { deleteRevision: false, revisePackage: false, writeFile: false }

// Bucket preferences with the package's write actions off until it is known unlocked.
export function usePrefs(status: Status): BucketPreferences.Result {
  const { prefs } = BucketPreferences.use()
  return React.useMemo(
    () =>
      status === 'unlocked'
        ? prefs
        : BucketPreferences.Result.match(
            {
              Ok: (p) =>
                BucketPreferences.Result.Ok({
                  ...p,
                  ui: { ...p.ui, actions: { ...p.ui.actions, ...LOCKED_ACTIONS } },
                }),
              _: () => prefs,
            },
            prefs,
          ),
    [prefs, status],
  )
}

type PrefsProviderProps = React.PropsWithChildren<{ status: Status }>

export function PrefsProvider({ status, children }: PrefsProviderProps) {
  return (
    <BucketPreferences.Override prefs={usePrefs(status)}>
      {children}
    </BucketPreferences.Override>
  )
}
