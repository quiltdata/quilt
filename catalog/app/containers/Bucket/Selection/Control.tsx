import * as React from 'react'
import * as M from '@material-ui/core'

import * as Dialogs from 'utils/Dialogs'

import Dashboard from './Dashboard'

type DashboardProps = React.ComponentProps<typeof Dashboard>

const DIALOG_PROPS = { fullWidth: true, maxWidth: 'md' as const }

const usePopupStyles = M.makeStyles({
  close: {
    marginLeft: 'auto',
  },
  title: {
    alignItems: 'center',
    display: 'flex',
  },
})

interface PopupProps extends DashboardProps {
  count: number
}

function Popup({ count, onClose, ...props }: PopupProps) {
  const classes = usePopupStyles()
  return (
    <>
      <M.DialogTitle disableTypography>
        <M.Typography className={classes.title} variant="h6">
          {count} items selected
          <M.IconButton size="small" className={classes.close} onClick={close}>
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </M.Typography>
      </M.DialogTitle>
      <M.DialogContent>
        <Dashboard onClose={onClose} {...props} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={onClose} variant="contained" color="primary" size="small">
          Close
        </M.Button>
      </M.DialogActions>
    </>
  )
}

// TODO: check mobile view

const useBadgeClasses = M.makeStyles({
  badge: {
    right: '4px',
  },
})

interface ButtonProps {
  className: string
  count: number
  onClick: () => void
}

export function Button({ className, count, onClick }: ButtonProps) {
  const badgeClasses = useBadgeClasses()
  return (
    <M.Badge
      badgeContent={count}
      classes={badgeClasses}
      className={className}
      color="primary"
      max={999}
      showZero
    >
      <M.Button onClick={onClick} size="small">
        Selected items
      </M.Button>
    </M.Badge>
  )
}

interface ControlProps extends Omit<DashboardProps, 'onClose'> {
  className: string
}

export function Control({
  className,
  onSelection,
  packageHandle,
  selection,
}: ControlProps) {
  const dialog = Dialogs.use()

  const count = Object.values(selection).reduce((memo, ids) => memo + ids.length, 0)
  const handleClick = () =>
    dialog.open(({ close: onClose }) => (
      <Popup {...{ count, onClose, onSelection, packageHandle, selection }} />
    ))

  return (
    <>
      <Button count={count} className={className} onClick={handleClick} />
      {dialog.render(DIALOG_PROPS)}
    </>
  )
}
