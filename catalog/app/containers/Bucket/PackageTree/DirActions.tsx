import * as React from 'react'

import * as Buttons from 'components/Buttons'
import * as BucketPreferences from 'utils/BucketPreferences'

import RevisionMenu from './RevisionMenu'

interface DirActionsProps {
  className: string
  children: (prefs: BucketPreferences.BucketPreferences) => React.ReactNode
  onCreateFile: () => void
  onDelete: () => void
  onDeletePackage: () => void
  onLock?: () => void
}

// The menu sits outside the prefs gate so Lock is reachable before the
// preferences load; RevisionMenu gates its own prefs-dependent items.
export default function DirActions({
  className,
  children,
  onCreateFile,
  onDelete,
  onDeletePackage,
  onLock,
}: DirActionsProps) {
  const { prefs } = BucketPreferences.use()
  return (
    <>
      {BucketPreferences.Result.match(
        {
          Ok: children,
          Pending: () => (
            <>
              <Buttons.Skeleton className={className} size="small" />
              <Buttons.Skeleton className={className} size="small" />
              <Buttons.Skeleton className={className} size="small" />
              <Buttons.Skeleton className={className} size="small" />
            </>
          ),
          Init: () => null,
        },
        prefs,
      )}
      <RevisionMenu
        className={className}
        onCreateFile={onCreateFile}
        onDelete={onDelete}
        onDeletePackage={onDeletePackage}
        onLock={onLock}
      />
    </>
  )
}
