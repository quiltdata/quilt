import * as React from 'react'
import * as M from '@material-ui/core'

import Code from 'components/Code'
import * as packageHandleUtils from 'utils/packageHandle'

interface PackageHandle {
  bucket: string
  name: string
  revision: string
}

interface DeleteDialogProps {
  onClose: () => void
  onRemove: () => void
  opened: boolean
  packageHandle: PackageHandle
}

function DeleteDialog({ opened, packageHandle, onClose, onRemove }: DeleteDialogProps) {
  return (
    <M.Dialog
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      open={opened}
      onClose={onClose}
    >
      <M.DialogTitle id="alert-dialog-title">Confirm deletion</M.DialogTitle>
      <M.DialogContent id="alert-dialog-description">
        <M.DialogContentText>
          You are about to delete{' '}
          <Code>{packageHandleUtils.shortenRevision(packageHandle.revision)}</Code>{' '}
          revison of <Code>{packageHandle.name}</Code> package.
        </M.DialogContentText>
        <M.DialogContentText>
          This action is non-reversible! Are you sure?
        </M.DialogContentText>
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose} color="primary" autoFocus>
          Cancel
        </M.Button>
        <M.Button onClick={onRemove} color="primary">
          Yes, delete
        </M.Button>
      </M.DialogActions>
    </M.Dialog>
  )
}

const useButtonStyles = M.makeStyles({
  root: {
    flexShrink: 0,
    margin: '-3px 0',
  },
})

interface ButtonProps {
  children: React.ReactNode
  onClick: () => void
}

function Button({ children, onClick }: ButtonProps) {
  const classes = useButtonStyles()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  const props = {
    'aria-haspopup': 'true' as 'true',
    className: classes.root,
    onClick,
    size: 'small' as 'small',
  }

  return sm ? (
    <M.IconButton edge="end" title={children?.toString()} {...props}>
      <M.Icon>delete_outline</M.Icon>
    </M.IconButton>
  ) : (
    <M.Button variant="outlined" {...props}>
      {children}
    </M.Button>
  )
}

interface DeleteButtonProps {
  children: React.ReactNode
  onRemove: (handle: PackageHandle) => void
  packageHandle: PackageHandle
}

export default function RemoveButton({
  children,
  onRemove,
  packageHandle,
}: DeleteButtonProps) {
  const [opened, setOpened] = React.useState(false)

  const handleClick = React.useCallback(() => setOpened(!opened), [opened, setOpened])

  const handleClose = React.useCallback(() => setOpened(false), [setOpened])

  const handleRemove = React.useCallback(() => onRemove(packageHandle), [
    packageHandle,
    onRemove,
  ])

  return (
    <>
      <Button onClick={handleClick}>{children}</Button>

      <DeleteDialog
        opened={opened}
        packageHandle={packageHandle}
        onClose={handleClose}
        onRemove={handleRemove}
      />
    </>
  )
}
