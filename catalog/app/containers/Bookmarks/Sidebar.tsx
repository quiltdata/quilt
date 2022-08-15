import * as React from 'react'
import * as M from '@material-ui/core'

import type { S3HandleBase } from 'utils/s3paths'

import { useBookmarks } from './Provider'

const useSidebarStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(1, 2),
  },
}))

export default function Sidebar() {
  const bookmarks = useBookmarks()
  const classes = useSidebarStyles()
  const entries = bookmarks?.groups.bookmarks?.entries
  const list: S3HandleBase[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  const handleSubmit = React.useCallback(() => {}, [])
  const isOpened = bookmarks?.isOpened
  return (
    <M.Drawer anchor="left" open={isOpened} onClose={bookmarks?.hide}>
      <div className={classes.root}>
        <M.List>
          {list.map((file) => (
            <M.ListItem>
              <M.ListItemIcon>
                <M.Icon>insert_drive_file</M.Icon>
              </M.ListItemIcon>
              <M.ListItemText>
                s3://{file.bucket}/{file.key}
              </M.ListItemText>
            </M.ListItem>
          ))}
        </M.List>
        <M.Button color="primary" variant="contained" onClick={handleSubmit}>
          Create package
        </M.Button>
      </div>
    </M.Drawer>
  )
}
