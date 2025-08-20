import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'

import Menu from '../Menu'

interface RevisionMenuProps {
  className: string
  onCreateFile: () => void
  onDelete: () => void
}

export default function RevisionMenu({
  className,
  onCreateFile,
  onDelete,
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
            }
            return menu
          },
          _: () => [],
        },
        prefs,
      ),
    [onCreateFile, onDelete, prefs],
  )

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
