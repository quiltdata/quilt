import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Buttons from 'components/Buttons'
import { useSelection } from 'containers/Bucket/Selection/Provider'

type ButtonProps = Omit<Buttons.WithPopoverProps, 'icon' | 'label'> &
  Partial<Pick<Buttons.WithPopoverProps, 'label'>>

export { default as Assist } from './Assist'

export function Add({ label = 'Add files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon={Icons.AddOutlined} label={label} {...props} />
}

export function Get({ label = 'Get files', ...props }: ButtonProps) {
  return <Buttons.WithPopover icon={Icons.GetAppOutlined} label={label} {...props} />
}

const useBadgeClasses = M.makeStyles({
  badge: {
    right: '4px',
  },
})

export function Organize({ label = 'Organize', ...props }: ButtonProps) {
  const slt = useSelection()
  const classes = useBadgeClasses()
  return (
    <M.Badge badgeContent={slt.totalCount} classes={classes} color="primary" max={999}>
      <Buttons.WithPopover
        icon={Icons.PlaylistAddCheckOutlined}
        label={label}
        disabled={slt.inited && !slt.totalCount}
        {...props}
      />
    </M.Badge>
  )
}

const useCreatePackageStyles = M.makeStyles({
  root: {
    transitionProperty: 'background-color, box-shadow',
  },
})

export function CreatePackage({
  label = 'Create package',
  className,
  ...props
}: ButtonProps) {
  const classes = useCreatePackageStyles()
  const slt = useSelection()
  return (
    <Buttons.WithPopover
      className={cx(classes.root, className)}
      label={label}
      variant={slt.isEmpty ? 'outlined' : 'contained'}
      color={slt.isEmpty ? 'default' : 'primary'}
      {...props}
    />
  )
}
