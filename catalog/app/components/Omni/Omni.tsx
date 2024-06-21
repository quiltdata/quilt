import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

interface Omni {
  isOpen: boolean
  open: () => void
  close: () => void
}

const Ctx = React.createContext<Omni | null>(null)

export function Provider({ children }: React.PropsWithChildren<{}>) {
  const [isOpen, setOpen] = React.useState(false)
  const open = React.useCallback(() => setOpen(true), [])
  const close = React.useCallback(() => setOpen(false), [])
  const value = React.useMemo(() => ({ isOpen, open, close }), [isOpen, open, close])
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2),
    width: '40vw',
  },
}))

export function Sidebar() {
  const classes = useStyles()

  const omni = React.useContext(Ctx)
  if (!omni) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer anchor="right" open={omni.isOpen} onClose={omni.close}>
        <div className={classes.root}>
          <M.Typography variant="h4">Qurator</M.Typography>
          sup
        </div>
      </M.Drawer>
    </M.MuiThemeProvider>
  )
}

const useTriggerStyles = M.makeStyles({
  trigger: {
    bottom: '50px',
    position: 'fixed',
    right: '100px',
    zIndex: 1,
  },
})

export function Trigger() {
  const classes = useTriggerStyles()
  const omni = React.useContext(Ctx)
  if (!omni) return null
  return (
    <M.Zoom in={!omni.isOpen}>
      <M.Fab onClick={omni.open} className={classes.trigger} color="primary">
        <M.Icon>assistant</M.Icon>
      </M.Fab>
    </M.Zoom>
  )
}
