import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'

import Menu from '../Menu'

interface RevisionMenuProps {
  className: string
  onCreateFile: () => void
  onDelete: () => void
  onDeletePackage: () => void
}

export default function RevisionMenu({
  className,
  onCreateFile,
  onDelete,
  onDeletePackage,
}: RevisionMenuProps) {
  const { prefs } = BucketPreferences.use()

  const items = React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) => {
            const menu = []
            if (actions.writeFile && actions.revisePackage) {
              menu.push({
                onClick: onCreateFile,
                title: 'Create file',
              })
            }
            if (actions.deleteRevision) {
              menu.push({
                onClick: onDelete,
                title: 'Delete revision',
              })
              // Same gate: anyone who may delete each revision may delete them all.
              menu.push({
                onClick: onDeletePackage,
                title: 'Delete package',
              })
            }
            return menu
          },
          _: () => [],
        },
        prefs,
      ),
    [onCreateFile, onDelete, onDeletePackage, prefs],
  )

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
