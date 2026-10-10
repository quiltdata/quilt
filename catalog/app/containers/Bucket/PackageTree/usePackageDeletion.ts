import * as R from 'ramda'
import * as React from 'react'

import * as GQL from 'utils/GraphQL'
import * as PackageLock from 'utils/PackageLock'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'

import DELETE_PACKAGE from './gql/DeletePackage.generated'
import DELETE_REVISION from './gql/DeleteRevision.generated'

export function usePackageDeletion(
  { bucket, name, hash }: PackageHandle,
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
          setDeletionState(
            R.mergeLeft({ error: PackageLock.errorMessage(r), loading: false }),
          )
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
