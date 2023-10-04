import * as React from 'react'

import * as M from '@material-ui/core'

interface MenuProps {
  className?: string
  items: {
    onClick: () => void
    title: string
  }[]
}

export default function Menu({ className, items }: MenuProps) {
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
