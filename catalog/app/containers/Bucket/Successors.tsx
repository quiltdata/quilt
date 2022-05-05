import * as React from 'react'
import * as M from '@material-ui/core'

import type * as workflows from 'utils/workflows'

import SuccessorsSelect from './SuccessorsSelect'

interface ButtonProps {
  children: string
  className: string
  onClick: React.MouseEventHandler<HTMLButtonElement>
}

function Button({ children, className, onClick }: ButtonProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return sm ? (
    <M.IconButton
      aria-haspopup
      className={className}
      edge="end"
      onClick={onClick}
      size="small"
      title={children}
    >
      <M.Icon>exit_to_app</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      aria-haspopup
      className={className}
      onClick={onClick}
      size="small"
      variant="outlined"
    >
      {children}
    </M.Button>
  )
}

interface CopyButtonProps {
  bucket: string
  className: string
  children: string
  onChange: (s: workflows.Successor) => void
}

export function CopyButton({ bucket, className, children, onChange }: CopyButtonProps) {
  const [menuAnchorEl, setMenuAnchorEl] = React.useState(null)

  const onButtonClick = React.useCallback(
    (event) => setMenuAnchorEl(event.currentTarget),
    [setMenuAnchorEl],
  )

  const onMenuClick = React.useCallback(
    (menuItem) => {
      onChange(menuItem)
      setMenuAnchorEl(null)
    },
    [onChange, setMenuAnchorEl],
  )

  const onMenuClose = React.useCallback(() => setMenuAnchorEl(null), [setMenuAnchorEl])

  return (
    <>
      <Button className={className} onClick={onButtonClick}>
        {children}
      </Button>

      <SuccessorsSelect
        anchorEl={menuAnchorEl}
        bucket={bucket}
        open={!!menuAnchorEl}
        onChange={onMenuClick}
        onClose={onMenuClose}
      />
    </>
  )
}
