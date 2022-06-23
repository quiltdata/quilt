import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as IPC from 'utils/electron/ipc-provider'
import * as Config from 'utils/Config'
import * as PackageUri from 'utils/PackageUri'
import { PackageHandle } from 'utils/packageHandle'
import { readableBytes } from 'utils/string'

const isNumber = (v: any) => typeof v === 'number' && !Number.isNaN(v)

interface OpenInDesktopProps {
  onClose: () => void
  open: boolean
  packageHandle: PackageHandle
  size?: number
}

export default function OpenInDesktop({
  onClose,
  open,
  packageHandle,
  size,
}: OpenInDesktopProps) {
  const { desktop } = Config.use()
  const ipc = IPC.use()
  const [error, setError] = React.useState<Error | null>(null)
  const [disabled, setDisabled] = React.useState(false)
  const handleConfirm = React.useCallback(async () => {
    try {
      if (desktop) {
        setDisabled(true)
        await ipc.invoke(IPC.EVENTS.DOWNLOAD_PACKAGE, packageHandle)
        setDisabled(false)
      } else {
        const deepLink = PackageUri.stringify(packageHandle, 'teleport')
        window.location.assign(deepLink)
      }
      onClose()
    } catch (e) {
      if (e instanceof Error) setError(e)
    }
  }, [desktop, ipc, onClose, packageHandle])

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
