import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import * as Buttons from 'components/Buttons'
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

function Popup({ close, ...props }: PopupProps) {
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

const LIST_ITEM_TYPOGRAPHY_PROPS = { noWrap: true }

export function Button({ className, onClick }: ButtonProps) {
  const slt = useSelection()
  const badgeClasses = useBadgeClasses()
  return (
    <M.Badge
      badgeContent={slt.totalCount}
      className={className}
      classes={badgeClasses}
      color="primary"
      max={999}
    >
      <Buttons.WithPopover
        disabled={!slt.totalCount}
        icon="playlist_add_check"
        label="Selected items"
      >
        <M.List dense>
          <M.ListItem button>
            <M.ListItemIcon>
              <M.Icon>turned_in_not</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText
              primary="Add to bookmarks"
              primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
            />
          </M.ListItem>
        </M.List>

        <M.Divider />

        <M.List dense>
          <M.ListItem onClick={onClick} button>
            <M.ListItemIcon>
              <M.Icon>edit</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText
              primary="Manage selection"
              primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
            />
          </M.ListItem>
          <M.ListItem button onClick={slt.clear}>
            <M.ListItemIcon>
              <M.Icon>clear</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText
              primary="Clear selection"
              primaryTypographyProps={LIST_ITEM_TYPOGRAPHY_PROPS}
            />
          </M.ListItem>
        </M.List>

        <M.Divider />

        <M.List dense>
          <M.ListItem button>
            <M.ListItemIcon>
              <M.Icon color="error">delete</M.Icon>
            </M.ListItemIcon>
            <M.ListItemText
              primary="Delete selected items"
              primaryTypographyProps={{ ...LIST_ITEM_TYPOGRAPHY_PROPS, color: 'error' }}
            />
          </M.ListItem>
        </M.List>
      </Buttons.WithPopover>
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
