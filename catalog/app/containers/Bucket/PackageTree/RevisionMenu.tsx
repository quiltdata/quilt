import * as React from 'react'

import cfg from 'constants/config'
import * as BucketPreferences from 'utils/BucketPreferences'

import Menu from '../Menu'

interface RevisionMenuProps {
  className: string
  onCreateFile: () => void
  onDelete: () => void
  onDesktop: () => void
}

export default function RevisionMenu({
  className,
  onCreateFile,
  onDelete,
  onDesktop,
}: RevisionMenuProps) {
  const prefs = BucketPreferences.use()

  const items = React.useMemo(
    () =>
      BucketPreferences.Result.match(
        {
          Ok: ({ ui: { actions } }) => {
            const menu = []
            if (actions.revisePackage) {
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
            if (actions.openInDesktop && !cfg.desktop) {
              menu.push({
                onClick: onDesktop,
                title: 'Open in Teleport',
              })
            }
            return menu
          },
          _: () => [],
        },
        prefs,
      ),
    [onCreateFile, onDelete, onDesktop, prefs],
  )

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
