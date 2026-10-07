import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as GQL from 'utils/GraphQL'

import LOCK_QUERY from './gql/Lock.generated'
import LOCK_STATE_QUERY from './gql/LockState.generated'

export type Status = 'loading' | 'locked' | 'unlocked'

interface Result {
  data?: { package: { bucket: string; name: string; lock: unknown } | null }
  error?: unknown
  fetching?: boolean
}

// A query error, including a registry without the lock field, reads as unlocked: the
// registry still refuses writes to a locked package.
function toStatus(
  { data, error, fetching }: Result,
  bucket: string,
  name: string,
  pause: boolean,
): Status {
  if (pause) return 'unlocked'
  const pkg = data?.package
  // urql keeps the previous variables' data while the next request is in flight.
  if (pkg && pkg.bucket === bucket && pkg.name === name) {
    return pkg.lock ? 'locked' : 'unlocked'
  }
  if (fetching || (!data && !error)) return 'loading'
  return 'unlocked'
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
    latestHash: result.data?.package?.latest?.hash,
    refresh,
  }
}

// Lock only, for checks that run per typed name.
export function useLockStatus(bucket: string, name: string, pause = false): Status {
  const result = GQL.useQuery(LOCK_STATE_QUERY, { bucket, name }, { pause })
  return toStatus(result, bucket, name, pause)
}

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
