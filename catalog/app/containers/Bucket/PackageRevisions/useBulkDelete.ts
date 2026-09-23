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

  // bucket and name are route params, so navigating to another package reuses
  // this hook; stale hashes would be deleted against the new package.
  React.useEffect(() => setSelected(new Set()), [bucket, name])

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
    setState(R.mergeLeft({ loading: true, error: undefined }))
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
        error = `Unexpected error: ${e.message ?? e} (${hash})`
        break
      }
    }
    setSelected((s) => new Set([...s].filter((h) => !done.has(h))))
    // The dialog's title tracks the selection, which just shrank by whatever
    // succeeded, so the error carries the only record of the partial result.
    if (error && done.size) error = `${error}. ${done.size} already deleted`
    setState({ error, loading: false, opened: !!error })
  }, [bucket, name, selected, deleteRevision])

  const confirm = React.useCallback(() => setState(R.mergeLeft({ opened: true })), [])

  const close = React.useCallback(
    () => setState(R.mergeLeft({ opened: false, error: undefined })),
    [],
  )

  return { selected, setSelected, toggle, state, confirm, close, run }
}
