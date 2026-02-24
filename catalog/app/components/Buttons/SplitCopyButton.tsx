import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

const useStyles = M.makeStyles((t) => ({
  copy: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
}))

interface SplitCopyButtonProps {
  children: React.ReactNode
  className?: string
  copyUri: string
  notification?: string
}

export default function SplitCopyButton({
  children,
  className,
  copyUri,
  notification = 'URI has been copied to clipboard',
}: SplitCopyButtonProps) {
  const classes = useStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(copyUri)
    push(notification)
  }, [copyUri, notification, push])
  return (
    <M.ButtonGroup variant="outlined" fullWidth className={className}>
      {children}
      <M.Button type="button" className={classes.copy} onClick={handleCopy}>
        <Icons.FileCopy fontSize="inherit" />
      </M.Button>
    </M.ButtonGroup>
  )
}
