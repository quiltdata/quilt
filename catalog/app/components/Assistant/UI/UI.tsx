import * as React from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as style from 'constants/style'
import * as routes from 'constants/routes'

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
  const location = useLocation()
  // The v2 bucket overview embeds an inline Qurator chat, so the floating Fab
  // would be redundant there and is hidden on that route.
  // NOTE: this hides the Fab on the overview route unconditionally, regardless
  // of the `ui.blocks.overviewV2` preference, because BucketPreferences is
  // provided deeper in the tree than this globally-mounted Trigger and isn't
  // available here. overviewV2 defaults to true, so the legacy overview (only
  // reachable with overviewV2 explicitly false) loses the Fab as its only
  // Qurator entry point -- an accepted tradeoff for this preview.
  const onOverview = !!matchPath(location.pathname, {
    path: routes.bucketOverview.path,
    exact: true,
  })
  if (!api || onOverview) return null
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
