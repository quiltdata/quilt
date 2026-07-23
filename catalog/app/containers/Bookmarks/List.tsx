import * as React from 'react'
import * as M from '@material-ui/core'

import type * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import * as s3paths from 'utils/s3paths'
import { trimCenter } from 'utils/string'

import { useBookmarks } from './Provider'

const useItemStyles = M.makeStyles((t) => ({
  iconWrapper: {
    minWidth: t.spacing(4),
  },
}))

interface ItemProps {
  handle: Model.S3.S3ObjectLocation
  onRemove: () => void
}

function Item({ handle, onRemove }: ItemProps) {
  const classes = useItemStyles()
  const { urls } = NamedRoutes.use()
  const to = urls.bucketFile(handle.bucket, handle.key)
  const title = `s3://${handle.bucket}/${handle.key}`
  return (
    <M.ListItem>
      <M.ListItemIcon className={classes.iconWrapper}>
        <M.Icon fontSize="small">
          {s3paths.isDir(handle.key) ? 'folder_open' : 'insert_drive_file'}
        </M.Icon>
      </M.ListItemIcon>
      <M.ListItemText>
        <StyledLink to={to}>{trimCenter(title, 66)}</StyledLink>
      </M.ListItemText>
      <M.ListItemSecondaryAction>
        <M.IconButton size="small" edge="end" onClick={onRemove}>
          <M.Icon fontSize="inherit">clear</M.Icon>
        </M.IconButton>
      </M.ListItemSecondaryAction>
    </M.ListItem>
  )
}

export function List() {
  const bookmarks = useBookmarks()
  const handles: Model.S3.S3ObjectLocation[] = React.useMemo(
    () => Object.values(bookmarks?.groups.main.entries ?? {}),
    [bookmarks],
  )

  if (!handles.length) {
    return (
      <M.List dense>
        <M.ListItem>
          <M.ListItemText
            primaryTypographyProps={{ color: 'textSecondary' }}
            primary="No bookmarks"
          />
        </M.ListItem>
      </M.List>
    )
  }

  return (
    <M.List dense>
      {handles.map((handle) => (
        <Item
          key={handle.bucket + handle.key}
          handle={handle}
          onRemove={() => bookmarks?.remove('main', handle)}
        />
      ))}
    </M.List>
  )
}
