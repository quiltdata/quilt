import * as React from 'react'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'

interface MenuProps {
  className?: string
  items: {
    onClick: () => void
    title: string
  }[]
}

function Menu({ className, items }: MenuProps) {
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleOpen = React.useCallback(
    (event) => setAnchorEl(event.target),
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => setAnchorEl(null), [setAnchorEl])

  const mkClickHandler = React.useCallback(
    (onClick: () => void) => () => {
      onClick()
      setAnchorEl(null)
    },
    [],
  )

  return (
    <>
      <M.IconButton className={className} onClick={handleOpen} size="small">
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>

      <M.Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        {items.map(({ onClick, title }) => (
          <M.MenuItem key={title} onClick={mkClickHandler(onClick)}>
            {title}
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

interface RevisionMenuProps {
  className: string
  onDelete: () => void
  onDesktop: () => void
}

export default function RevisionMenu({
  className,
  onDelete,
  onDesktop,
}: RevisionMenuProps) {
  const preferences = BucketPreferences.use()
  const { desktop }: { desktop: boolean } = Config.use()

  const items = React.useMemo(() => {
    const menu = []
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
  }, [desktop, onDelete, onDesktop, preferences])

  return <Menu className={className} items={items} />
}
