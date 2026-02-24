import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import { usePopoverClose } from 'components/Buttons'
import * as Notifications from 'containers/Notifications'
import copyToClipboard from 'utils/clipboard'

export function useDownloadFeedback(): {
  onClick: () => void
  startIcon?: React.ReactNode
} {
  const closePopover = usePopoverClose()
  const [downloading, setDownloading] = React.useState(false)
  React.useEffect(() => {
    if (!downloading) return
    const timer = setTimeout(() => {
      setDownloading(false)
      closePopover()
    }, 1000)
    return () => clearTimeout(timer)
  }, [downloading, closePopover])
  return React.useMemo(
    () => ({
      onClick: () => setDownloading(true),
      ...(downloading ? { startIcon: <M.CircularProgress size={20} /> } : null),
    }),
    [downloading],
  )
}

const useSplitCopyButtonStyles = M.makeStyles((t) => ({
  root: {
    whiteSpace: 'nowrap',
    width: '100%',
  },
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

export function SplitCopyButton({
  children,
  className,
  copyUri,
  notification = 'URI has been copied to clipboard',
}: SplitCopyButtonProps) {
  const classes = useSplitCopyButtonStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(copyUri)
    push(notification)
  }, [copyUri, notification, push])
  return (
    <M.ButtonGroup variant="outlined" className={`${classes.root} ${className || ''}`}>
      {children}
      <M.Button type="button" className={classes.copy} onClick={handleCopy}>
        <Icons.FileCopy fontSize="inherit" />
      </M.Button>
    </M.ButtonGroup>
  )
}
