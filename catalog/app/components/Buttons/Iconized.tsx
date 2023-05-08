import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  icon: {
    transition: 'ease transform .15s',
  },
  iconRotated: {
    transform: `rotate(180deg)`,
  },
})

interface ButtonIconizedProps extends M.IconButtonProps {
  icon: string
  label: string
  rotate?: boolean
  variant?: 'text' | 'outlined' | 'contained'
}

export default function ButtonIconized({
  className,
  label,
  icon,
  rotate,
  variant = 'outlined',
  ...props
}: ButtonIconizedProps) {
  const classes = useStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  const iconElement = (
    <M.Icon className={cx(classes.icon, { [classes.iconRotated]: rotate })}>
      {icon}
    </M.Icon>
  )

  return sm ? (
    <M.IconButton className={className} edge="end" size="small" title={label} {...props}>
      {iconElement}
    </M.IconButton>
  ) : (
    <M.Button
      className={className}
      size="small"
      startIcon={iconElement}
      variant={variant}
      {...props}
    >
      {label}
    </M.Button>
  )
}
