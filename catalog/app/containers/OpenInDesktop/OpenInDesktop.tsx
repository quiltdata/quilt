import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as IPC from 'utils/electron/ipc-provider'
import * as Config from 'utils/Config'
import * as TeleportUri from 'utils/TeleportUri'
import { PackageHandle } from 'utils/packageHandle'
import { readableBytes } from 'utils/string'

const SIZE_THRESHOLD = 1024 * 1024 * 100

const isNumber = (v: any) => typeof v === 'number' && !Number.isNaN(v)

interface OpenInDesktopProps {
  onClose: () => void
  onConfirm: () => Promise<void>
  open: boolean
  size?: number
}

export function Dialog({ onClose, onConfirm, open, size }: OpenInDesktopProps) {
  const [error, setError] = React.useState<Error | null>(null)
  const [disabled, setDisabled] = React.useState(false)
  const handleConfirm = React.useCallback(async () => {
    try {
      setDisabled(true)
      await onConfirm()
      setDisabled(false)
      onClose()
    } catch (e) {
      if (e instanceof Error) setError(e)
    }
  }, [onClose, onConfirm])
  return (
    <M.Dialog open={open} onClose={onClose}>
      <M.DialogTitle>Open in Teleport</M.DialogTitle>
      <M.DialogContent>
        <M.Typography>Download package and open in desktop application</M.Typography>
        {isNumber(size) && (
          <M.Typography>Total size of package is {readableBytes(size)}</M.Typography>
        )}
        <M.Typography>It could take a while</M.Typography>
        {error && <Lab.Alert severity="error">{error.message}</Lab.Alert>}
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose}>Cancel</M.Button>
        <M.Button
          color="primary"
          disabled={disabled}
          onClick={handleConfirm}
          variant="contained"
        >
          Confirm
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

function useOpenInDesktop(packageHandle: PackageHandle, size?: number) {
  const { desktop } = Config.use()
  const ipc = IPC.use()

  const [confirming, setConfirming] = React.useState(false)
  const openInDesktop = React.useCallback(async () => {
    if (desktop) {
      await ipc.invoke(IPC.EVENTS.DOWNLOAD_PACKAGE, packageHandle)
    } else {
      const deepLink = TeleportUri.stringify(packageHandle)
      window.location.assign(deepLink)
    }
  }, [desktop, ipc, packageHandle])
  const unconfirm = React.useCallback(() => setConfirming(false), [])
  const confirm = React.useCallback(() => {
    if (!size || size > SIZE_THRESHOLD) {
      setConfirming(true)
    } else {
      openInDesktop()
    }
  }, [openInDesktop, size])
  // TODO: probably rename OpenInDesktop to something
  //       then you can rename confirm → open, unconfirm → close
  return {
    confirm,
    confirming,
    openInDesktop,
    unconfirm,
  }
}

export const use = useOpenInDesktop
