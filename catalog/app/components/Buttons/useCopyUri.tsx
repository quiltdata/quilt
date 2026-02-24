import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import type * as Toolbar from 'containers/Bucket/Toolbar'
import * as PackageUri from 'utils/PackageUri'
import copyToClipboard from 'utils/clipboard'

type Handle = Toolbar.DirHandle | Toolbar.FileHandle | PackageUri.PackageUri

function toUri(handle: Handle): string {
  if ('_tag' in handle) {
    if (handle._tag === 'dir') return `s3://${handle.bucket}/${handle.path}`
    return `s3://${handle.bucket}/${handle.key}`
  }
  return PackageUri.stringify(handle)
}

export const useStyles = M.makeStyles((t) => ({
  copy: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
}))

export default function useCopyUri(handle: Handle) {
  const uri = toUri(handle)
  const { push } = Notifications.use()
  const onClick = React.useCallback(() => {
    copyToClipboard(uri)
    push('URI has been copied to clipboard')
  }, [uri, push])
  return { onClick, icon: <Icons.FileCopy fontSize="inherit" /> }
}
