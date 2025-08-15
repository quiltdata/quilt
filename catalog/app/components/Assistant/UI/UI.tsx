import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'

const useSidebarStyles = M.makeStyles({
  sidebar: {
    background: M.colors.indigo[50],
    display: 'flex',
    height: '100%',
    maxWidth: '40rem',
    width: '50vw',
  },
})

function Sidebar() {
  const classes = useSidebarStyles()

  const api = Model.useAssistantAPI()
  if (!api) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer anchor="right" open={api.visible} onClose={api.hide}>
        <div className={classes.sidebar}>
          <Chat state={api.state} dispatch={api.dispatch} devTools={api.devTools} />
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

function Trigger() {
  const classes = useTriggerStyles()
  const api = Model.useAssistantAPI()
  if (!api) return null
  return (
    <M.Zoom in={!api.visible}>
      <M.Fab onClick={api.show} className={classes.trigger} color="primary">
        <M.Icon>assistant</M.Icon>
      </M.Fab>
    </M.Zoom>
  )
}

export function WithAssistantUI({ children }: React.PropsWithChildren<{}>) {
  return (
    <>
      {children}
      <Trigger />
      <Sidebar />
    </>
  )
}
