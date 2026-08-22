import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Dialogs from 'utils/Dialogs'

import Dashboard from './Dashboard'
import { useSelection } from './Provider'

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

interface PopupProps extends Omit<DashboardProps, 'onClose'> {
  close: () => void
}

export function Popup({ close, ...props }: PopupProps) {
  const slt = useSelection()
  const classes = usePopupStyles()

  const location = RRDom.useLocation()
  const firstRender = React.useRef(true)
  React.useEffect(() => {
    if (!firstRender.current) {
      close()
    }
    firstRender.current = false
  }, [close, location.pathname])

  return (
    <>
      <M.DialogTitle disableTypography>
        <M.Typography className={classes.title} variant="h6">
          {slt.totalCount} items selected
          <M.IconButton size="small" className={classes.close} onClick={close}>
            <M.Icon>close</M.Icon>
          </M.IconButton>
        </M.Typography>
      </M.DialogTitle>
      <M.DialogContent>
        <Dashboard onClose={close} {...props} />
      </M.DialogContent>
      <M.DialogActions>
        <M.Button onClick={close} variant="contained" color="primary" size="small">
          Close
        </M.Button>
      </M.DialogActions>
    </>
  )
}

const useBadgeClasses = M.makeStyles({
  badge: {
    right: '4px',
  },
})

interface ButtonProps {
  className: string
  onClick: () => void
}

export function Button({ className, onClick }: ButtonProps) {
  const slt = useSelection()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  const badgeClasses = useBadgeClasses()
  return (
    <M.Badge
      badgeContent={slt.totalCount}
      classes={badgeClasses}
      className={className}
      color="primary"
      max={999}
      showZero
    >
      {sm ? (
        <M.IconButton
          className={className}
          edge="end"
          size="small"
          title={'Selected items'}
          onClick={onClick}
        >
          <M.Icon>playlist_add_check</M.Icon>
        </M.IconButton>
      ) : (
        <M.Button onClick={onClick} size="small">
          Selected items
        </M.Button>
      )}
    </M.Badge>
  )
}

interface ControlProps extends Omit<DashboardProps, 'onClose'> {
  className: string
}

export function Control({ className, ...rest }: ControlProps) {
  const dialog = Dialogs.use()

  const handleClick = () => dialog.open((props) => <Popup {...{ ...props, ...rest }} />)

  return (
    <>
      <Button className={className} onClick={handleClick} />
      {dialog.render(DIALOG_PROPS)}
    </>
  )
}
