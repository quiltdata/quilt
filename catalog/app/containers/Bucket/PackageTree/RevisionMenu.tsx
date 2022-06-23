import * as React from 'react'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'
import * as Config from 'utils/Config'

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
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null)

  const handleOpen = React.useCallback(
    (event) => {
      setAnchorEl(event.target)
    },
    [setAnchorEl],
  )

  const handleClose = React.useCallback(() => {
    setAnchorEl(null)
  }, [setAnchorEl])

  const handleDeleteClick = React.useCallback(() => {
    onDelete()
    setAnchorEl(null)
  }, [onDelete, setAnchorEl])
  const handleDesktopClick = React.useCallback(() => {
    onDesktop()
    setAnchorEl(null)
  }, [onDesktop, setAnchorEl])

  return (
    <>
      <M.IconButton className={className} onClick={handleOpen} size="small">
        <M.Icon>more_vert</M.Icon>
      </M.IconButton>

      <M.Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        {preferences?.ui?.actions?.deleteRevision && (
          <M.MenuItem onClick={handleDeleteClick}>Delete revision</M.MenuItem>
        )}
        {preferences?.ui?.actions?.openInDesktop && !desktop && (
          <M.MenuItem onClick={handleDesktopClick}>Open in Teleport</M.MenuItem>
        )}
      </M.Menu>
    </>
  )
}
