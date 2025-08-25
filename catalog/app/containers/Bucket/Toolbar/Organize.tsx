import * as React from 'react'
import * as M from '@material-ui/core'

import { PlaylistAddCheckOutlined as IconPlaylistAddCheckOutlined } from '@material-ui/icons'

import * as Buttons from 'components/Buttons'
import { useSelection } from 'containers/Bucket/Selection/Provider'

const useBadgeClasses = M.makeStyles({
  badge: {
    right: '4px',
  },
})

interface ButtonProps {
  children: NonNullable<React.ReactNode>
  className?: string
  onReload: () => void
}

export default function Button({ onReload, ...props }: ButtonProps) {
  const slt = useSelection()
  const classes = useBadgeClasses()
  return (
    <M.Badge badgeContent={slt.totalCount} classes={classes} color="primary" max={999}>
      <Buttons.WithPopover
        icon={IconPlaylistAddCheckOutlined}
        label="Organize"
        disabled={slt.inited && !slt.totalCount}
        {...props}
      />
    </M.Badge>
  )
}
