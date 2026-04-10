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

const useCopyButtonStyles = M.makeStyles((t) => ({
  root: {
    fontSize: t.typography.body1.fontSize,
    width: 'auto',
  },
  mono: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

interface CopyButtonProps {
  uri: string
}

export function CopyButton({ uri, ...props }: CopyButtonProps & M.ButtonProps) {
  const classes = useCopyButtonStyles()
  const { push } = Notifications.use()
  const handleCopy = React.useCallback(() => {
    copyToClipboard(uri)
    push('URI has been copied to clipboard')
  }, [uri, push])
  return (
    <M.Tooltip title={<span className={classes.mono}>{uri}</span>}>
      <M.Button className={classes.root} onClick={handleCopy} {...props}>
        <Icons.FileCopy fontSize="inherit" />
      </M.Button>
    </M.Tooltip>
  )
}
