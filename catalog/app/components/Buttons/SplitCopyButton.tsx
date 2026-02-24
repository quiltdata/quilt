import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-flex',
  },
  main: {
    justifyContent: 'flex-start',
    whiteSpace: 'nowrap',
  },
  copy: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
}))

type SplitCopyButtonProps = Omit<M.ButtonProps, 'variant'> & {
  copyUri: string
  download?: boolean
  icon?: React.ReactNode
  notification?: string
}

export default function SplitCopyButton({
  children,
  className,
  copyUri,
  icon,
  notification = 'URI has been copied to clipboard',
  startIcon,
  ...buttonProps
}: SplitCopyButtonProps) {
  const classes = useStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(copyUri)
    push(notification)
  }, [copyUri, notification, push])
  return (
    <M.ButtonGroup variant="outlined" className={`${classes.root} ${className || ''}`}>
      <M.Button startIcon={startIcon || icon} className={classes.main} {...buttonProps}>
        {children}
      </M.Button>
      <M.Button type="button" className={classes.copy} onClick={handleCopy}>
        <Icons.FileCopy fontSize="inherit" />
      </M.Button>
    </M.ButtonGroup>
  )
}
