import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import RightSidebar from './RightSidebar'

const DRAWER_WIDTH = '40rem' // 640px max width for the assistant drawer

const useSidebarStyles = M.makeStyles({
  sidebar: {
    background: M.colors.indigo[50],
    display: 'flex',
    height: '100%',
    maxWidth: DRAWER_WIDTH,
    width: '50vw',
  },
  drawer: {
    width: DRAWER_WIDTH,
    maxWidth: '50vw',
    flexShrink: 0,
  },
  drawerPaper: {
    width: DRAWER_WIDTH,
    maxWidth: '50vw',
  },
})

const useContentStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    minHeight: '100vh',
    position: 'relative',
  },
  content: {
    flexGrow: 1,
    transition: t.transitions.create(['margin', 'width'], {
      easing: t.transitions.easing.sharp,
      duration: t.transitions.duration.leavingScreen,
    }),
    marginRight: 0,
    width: '100%',
  },
  contentShift: {
    transition: t.transitions.create(['margin', 'width'], {
      easing: t.transitions.easing.easeOut,
      duration: t.transitions.duration.enteringScreen,
    }),
    marginRight: `min(${DRAWER_WIDTH}, 50vw)`,
    width: `calc(100% - min(${DRAWER_WIDTH}, 50vw))`,
  },
}))

function Sidebar() {
  const classes = useSidebarStyles()

  const api = Model.useAssistantAPI()
  if (!api) return null

  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer
        className={classes.drawer}
        anchor="right"
        open={api.visible}
        onClose={api.hide}
        variant="persistent"
        classes={{
          paper: classes.drawerPaper,
        }}
      >
        <div className={classes.sidebar}>
          <Chat state={api.state} dispatch={api.dispatch} devTools={api.devTools} />
        </div>
      </M.Drawer>
    </M.MuiThemeProvider>
  )
}

// Trigger component removed - replaced with RightSidebar

export function WithAssistantUI({ children }: React.PropsWithChildren<{}>) {
  const api = Model.useAssistantAPI()
  const classes = useContentStyles()

  return (
    <div className={classes.root}>
      <div className={`${classes.content} ${api?.visible ? classes.contentShift : ''}`}>
        {children}
      </div>
      <RightSidebar
        onQurator={api?.show || (() => {})}
        quratorActive={api?.visible || false}
        contextUsagePercent={undefined} // Token usage tracking not yet implemented
      />
      <Sidebar />
    </div>
  )
}
