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

interface ButtonIconShrinkingProps extends M.IconButtonProps {
  label: string
  icon: string
  rotate?: boolean
}

export default function ButtonIconShrinking({
  className,
  label,
  icon,
  rotate,
  ...props
}: ButtonIconShrinkingProps) {
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
      variant="outlined"
      {...props}
    >
      {label}
    </M.Button>
  )
}
