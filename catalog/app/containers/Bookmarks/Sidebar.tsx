// import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

// import type * as Model from 'model'
import type { S3HandleBase } from 'utils/s3paths'

import { useBookmarks } from './Provider'

export default function Sidebar() {
  const bookmarks = useBookmarks()
  const entries = bookmarks?.groups.bookmarks?.entries
  const list: S3HandleBase[] = React.useMemo(
    () => (entries ? Object.values(entries) : []),
    [entries],
  )
  //   const isOpened = bookmarks?.isOpened || true
  const isOpened = bookmarks?.isOpened
  return (
    <M.Drawer anchor="left" open={isOpened} onClose={bookmarks?.hide}>
      <M.List>
        {list.map((file) => (
          <M.ListItem>{file.key}</M.ListItem>
        ))}
      </M.List>
    </M.Drawer>
  )
}
