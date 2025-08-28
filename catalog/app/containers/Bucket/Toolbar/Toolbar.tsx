import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import {
  AddOutlined as IconAddOutlined,
  GetAppOutlined as IconGetAppOutlined,
  PlaylistAddCheckOutlined as IconPlaylistAddCheckOutlined,
} from '@material-ui/icons'

import * as Buttons from 'components/Buttons'
import { useSelection } from 'containers/Bucket/Selection/Provider'

// Placeholder type - will be replaced by WithPopoverProps from PR #1
type ButtonProps = {
  label?: string
  disabled?: boolean
  onClick?: () => void
  children?: React.ReactNode
  className?: string
}

export { default as Assist } from './Assist'

export function Add({ label = 'Add files', ...props }: ButtonProps) {
  // Placeholder implementation - will use WithPopover from PR #1
  return <Buttons.Iconized icon="add" label={label} {...props} />
}

export function Get({ label = 'Get files', ...props }: ButtonProps) {
  // Placeholder implementation - will use WithPopover from PR #1
  return <Buttons.Iconized icon="get_app" label={label} {...props} />
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
      <Buttons.Iconized
        icon="playlist_add_check"
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
}: ButtonProps & { className?: string }) {
  const classes = useCreatePackageStyles()
  const slt = useSelection()
  return (
    <Buttons.Iconized
      className={cx(classes.root, className)}
      icon="add_box"
      label={label}
      variant={slt.isEmpty ? 'outlined' : 'contained'}
      {...props}
    />
  )
}
