import * as React from 'react'
import * as M from '@material-ui/core'

import SuccessorsSelect from './SuccessorsSelect'

function Button({ children, className, onClick }) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  const props = {
    'aria-haspopup': 'true',
    className,
    onClick,
    size: 'small',
  }

  return sm ? (
    <M.IconButton edge="end" title={children} {...props}>
      <M.Icon>exit_to_app</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button variant="outlined" {...props}>
      {children}
    </M.Button>
  )
}

export default function CopyButton({ bucket, className, children, onChange }) {
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
