import * as R from 'ramda'
import * as React from 'react'

import * as GQL from 'utils/GraphQL'
import type * as PackageLockState from 'utils/PackageLock'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import DELETE_PACKAGE from './gql/DeletePackage.generated'
import DELETE_REVISION from './gql/DeleteRevision.generated'

export function usePackageDeletion(
  { bucket, name, hash }: PackageHandle,
  lock: PackageLockState.Status,
  onDeleted: () => void,
) {
  const [deletionState, setDeletionState] = React.useState({
    error: undefined as React.ReactNode | undefined,
    loading: false,
    opened: false,
    scope: 'revision' as 'revision' | 'package',
  })

  const confirmDelete = React.useCallback(
    () => setDeletionState(R.mergeLeft({ opened: true, scope: 'revision' })),
    [],
  )

  const confirmDeletePackage = React.useCallback(
    () => setDeletionState(R.mergeLeft({ opened: true, scope: 'package' })),
    [],
  )

  const onPackageDeleteDialogClose = React.useCallback(() => {
    setDeletionState(
      R.mergeLeft({
        error: undefined,
        opened: false,
      }),
    )
  }, [])

  const deleteRevision = GQL.useMutation(DELETE_REVISION)
  const deletePackage = GQL.useMutation(DELETE_PACKAGE)

  const handlePackageDeletion = React.useCallback(async () => {
    if (lock !== 'unlocked') {
      const error =
        lock === 'loading'
          ? 'Still checking whether this package is locked…'
          : 'This package is locked'
      setDeletionState(R.mergeLeft({ error }))
      return
    }
    setDeletionState(R.assoc('loading', true))
    try {
      const r =
        deletionState.scope === 'package'
          ? (await deletePackage({ bucket, name })).packageDelete
          : (await deleteRevision({ bucket, name, hash })).packageRevisionDelete
      switch (r.__typename) {
        case 'Ok':
        case 'PackageRevisionDeleteSuccess':
          setDeletionState(R.mergeLeft({ opened: false, loading: false }))
          onDeleted()
          return
        case 'OperationError':
          setDeletionState(R.mergeLeft({ error: r.message, loading: false }))
          return
        default:
          assertNever(r)
      }
    } catch (e: any) {
      let error = 'Unexpected error'
      if (e.message) error = `${error}: ${e.message}`
      setDeletionState(R.mergeLeft({ error, loading: false }))
    }
  }, [
    bucket,
    hash,
    name,
    deletionState.scope,
    deletePackage,
    lock,
    deleteRevision,
    onDeleted,
    setDeletionState,
  ])

  return {
    deletionState,
    confirmDelete,
    confirmDeletePackage,
    onPackageDeleteDialogClose,
    handlePackageDeletion,
  }
}
