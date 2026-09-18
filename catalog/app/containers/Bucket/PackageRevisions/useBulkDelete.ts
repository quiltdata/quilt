import * as R from 'ramda'
import * as React from 'react'

import * as GQL from 'utils/GraphQL'

import DELETE_REVISION from '../PackageTree/gql/DeleteRevision.generated'

// Deletes one at a time and stops at the first failure, so a partial failure
// leaves the survivors selected.
export function useBulkDelete(bucket: string, name: string) {
  const deleteRevision = GQL.useMutation(DELETE_REVISION)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [state, setState] = React.useState({
    error: undefined as React.ReactNode | undefined,
    loading: false,
    opened: false,
  })

  const toggle = React.useCallback(
    (hash: string) =>
      setSelected((s) => {
        const next = new Set(s)
        if (!next.delete(hash)) next.add(hash)
        return next
      }),
    [],
  )

  const run = React.useCallback(async () => {
    setState(R.assoc('loading', true))
    const done = new Set<string>()
    let error: React.ReactNode | undefined
    for (const hash of selected) {
      try {
        const r = (await deleteRevision({ bucket, name, hash })).packageRevisionDelete
        if (r.__typename === 'OperationError') {
          error = `${r.message} (${hash})`
          break
        }
        done.add(hash)
      } catch (e: any) {
        error = `Unexpected error: ${e.message ?? e}`
        break
      }
    }
    setSelected((s) => new Set([...s].filter((h) => !done.has(h))))
    setState({ error, loading: false, opened: !!error })
  }, [bucket, name, selected, deleteRevision])

  return {
    selected,
    setSelected,
    toggle,
    state,
    confirm: () => setState(R.mergeLeft({ opened: true })),
    close: () => setState(R.mergeLeft({ opened: false, error: undefined })),
    run,
  }
}
