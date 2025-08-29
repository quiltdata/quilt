import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type * as SvgIcons from '@material-ui/icons'

export type SvgIcon = typeof SvgIcons.AddOutlined | typeof SvgIcons.GetAppOutlined

export type StrIcon =
  | 'ac_unit'
  | 'add'
  | 'archive'
  | 'delete'
  | 'download'
  | 'edit'
  | 'exit_to_app'
  | 'playlist_add_check'
  | 'save'
  | 'undo'
  | 'unfold_less'
  | 'unfold_more'

const useIconStyles = M.makeStyles({
  root: {
    transition: 'ease transform .15s',
  },
  rotated: {
    transform: `rotate(180deg)`,
  },
})

interface StringIconProps extends M.IconProps {
  children: string
}

function StringIcon({ children, ...iconProps }: StringIconProps) {
  return <M.Icon {...iconProps}>{children}</M.Icon>
}

interface IconProps {
  icon: StrIcon | SvgIcon
  rotate?: boolean
}

function Icon({ icon, rotate }: IconProps) {
  const classes = useIconStyles()
  const IconComponent = React.useMemo(
    () => (typeof icon === 'string' ? StringIcon : icon),
    [icon],
  )
  const iconProps = typeof icon === 'string' ? { children: icon } : {}
  return (
    <IconComponent
      className={cx(classes.root, { [classes.rotated]: rotate })}
      {...iconProps}
    />
  )
}

interface ButtonIconizedProps extends M.IconButtonProps {
  icon: StrIcon | SvgIcon
  label: string
  rotate?: boolean
  variant?: 'text' | 'outlined' | 'contained'
  endIcon?: React.ReactNode
}

export default function ButtonIconized({
  className,
  endIcon,
  icon,
  label,
  rotate,
  variant = 'outlined',
  ...props
}: ButtonIconizedProps) {
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return sm ? (
    <M.IconButton className={className} edge="end" size="small" title={label} {...props}>
      <Icon icon={icon} rotate={rotate} />
    </M.IconButton>
  ) : (
    <M.Button
      className={className}
      endIcon={endIcon}
      size="small"
      startIcon={<Icon icon={icon} rotate={rotate} />}
      variant={variant}
      {...props}
    >
      {label}
    </M.Button>
  )
}
