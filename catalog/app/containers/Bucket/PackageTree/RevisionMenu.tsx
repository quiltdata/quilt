import * as React from 'react'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'

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
  const { desktop }: { desktop: boolean } = Config.use()

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
    if (preferences?.ui?.actions?.openInDesktop && !desktop) {
      menu.push({
        onClick: onDesktop,
        title: 'Open in Teleport',
      })
    }
    return menu
  }, [desktop, onCreateFile, onDelete, onDesktop, preferences])

  if (!items.length) return null

  return <Menu className={className} items={items} />
}
