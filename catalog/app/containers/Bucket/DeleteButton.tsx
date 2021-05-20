import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useButtonStyles = M.makeStyles({
  root: {
    flexShrink: 0,
    margin: '-3px 0',
  },
})

interface DeleteButtonProps {
  children: React.ReactNode
  className?: string
  onClick: () => void
}

export default function DeleteButton({
  children,
  className,
  onClick,
}: DeleteButtonProps) {
  const classes = useButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  const props = {
    'aria-haspopup': 'true' as 'true',
    className: cx(classes.root, className),
    onClick,
    size: 'small' as 'small',
  }

  return sm ? (
    <M.IconButton edge="end" title={children?.toString()} {...props}>
      <M.Icon>delete_outline</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button variant="outlined" {...props}>
      {children}
    </M.Button>
  )
}
