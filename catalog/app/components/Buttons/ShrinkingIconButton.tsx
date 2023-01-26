import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  root: {
    flexShrink: 0,
    marginBottom: -3,
    marginTop: -3,
  },
})

interface ShrinkingIconButtonProps extends M.IconButtonProps {
  label: React.ReactNode
  icon: string
}

export default function ShrinkingIconButton({
  className,
  label,
  icon,
  ...props
}: ShrinkingIconButtonProps) {
  const classes = useStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return sm ? (
    <M.IconButton
      className={cx(classes.root, className)}
      edge="end"
      size="small"
      {...props}
    >
      <M.Icon>{icon}</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button
      className={cx(classes.root, className)}
      variant="outlined"
      size="small"
      startIcon={<M.Icon>{icon}</M.Icon>}
      {...props}
    >
      {label}
    </M.Button>
  )
}
