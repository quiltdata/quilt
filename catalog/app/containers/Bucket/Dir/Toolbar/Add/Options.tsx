import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Context from './Context'

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true } as const

interface MenuItemProps {
  icon: React.ReactElement
  primary: string
  onClick: () => void
}

function MenuItem({ icon, primary, onClick }: MenuItemProps) {
  return (
    <M.ListItem button onClick={onClick}>
      <M.ListItemIcon>{icon}</M.ListItemIcon>
      <M.ListItemText
        primary={primary}
        primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
      />
    </M.ListItem>
  )
}

export default function AddOptions() {
  const { createFile, openUploadDialog } = Context.use()
  return (
    <M.List dense>
      <MenuItem
        icon={<Icons.CreateOutlined />}
        primary="Create text file"
        onClick={createFile}
      />
      <MenuItem
        icon={<Icons.PublishOutlined />}
        primary="Upload files"
        onClick={openUploadDialog}
      />
    </M.List>
  )
}
