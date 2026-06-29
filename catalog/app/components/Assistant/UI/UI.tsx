import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import * as InlinePresence from './InlinePresence'

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
  const inlined = InlinePresence.useInlined()
  if (!api) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer anchor="right" open={api.visible && !inlined} onClose={api.hide}>
        <div className={classes.sidebar}>
          <Chat
            state={api.state}
            dispatch={api.dispatch}
            devTools={api.devTools}
            connectors={api.connectors}
          />
        </div>
      </M.Drawer>
    </M.MuiThemeProvider>
  )
}

export function Trigger() {
  const api = Model.useAssistantAPI()
  const inlined = InlinePresence.useInlined()
  if (!api || inlined || api.visible) return null
  return (
    <M.IconButton
      color="inherit"
      onClick={api.show}
      aria-label="Open Qurator AI assistant"
    >
      <M.Icon>assistant</M.Icon>
    </M.IconButton>
  )
}

export function WithAssistantUI({ children }: React.PropsWithChildren<{}>) {
  return (
    <InlinePresence.Provider>
      {children}
      <Sidebar />
    </InlinePresence.Provider>
  )
}
