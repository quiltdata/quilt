import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'

import Menu from '../Menu'

// An omitted handler hides its item.
interface RevisionMenuProps {
  className: string
  onCreateFile?: () => void
  onDelete?: () => void
  onDeletePackage?: () => void
  onLock?: () => void
}

export default function RevisionMenu({
  className,
  onCreateFile,
  onDelete,
  onDeletePackage,
  onLock,
}: RevisionMenuProps) {
  const { prefs } = BucketPreferences.use()

  const items = React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) => {
            const menu = []
            if (onCreateFile && actions.writeFile && actions.revisePackage) {
              menu.push({
                onClick: onCreateFile,
                title: 'Create file',
              })
            }
            if (actions.deleteRevision) {
              if (onDelete) {
                menu.push({
                  onClick: onDelete,
                  title: 'Delete revision',
                })
              }
              // Same gate: anyone who may delete each revision may delete them all.
              if (onDeletePackage) {
                menu.push({
                  onClick: onDeletePackage,
                  title: 'Delete package',
                })
              }
            }
            if (onLock) {
              menu.push({
                onClick: onLock,
                title: 'Lock package',
              })
            }
            return menu
          },
          _: () => [],
        },
        prefs,
      ),
    [onCreateFile, onDelete, onDeletePackage, onLock, prefs],
  )

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
