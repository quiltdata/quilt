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
  const { preferences } = BucketPreferences.use()

  const items = React.useMemo(() => {
    const menu = []
    if (preferences?.ui?.actions?.revisePackage) {
      menu.push({
        onClick: onCreateFile,
        title: 'Create file',
      })
    }
    if (preferences?.ui?.actions?.deleteRevision) {
      menu.push({
        onClick: onDelete,
        title: 'Delete revision',
      })
    }
    if (preferences?.ui?.actions?.openInDesktop && !cfg.desktop) {
      menu.push({
        onClick: onDesktop,
        title: 'Open in Teleport',
      })
    }
    return menu
  }, [onCreateFile, onDelete, onDesktop, preferences])

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
