import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import RightSidebar from './RightSidebar'

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

// Trigger component removed - replaced with RightSidebar

export function WithAssistantUI({ children }: React.PropsWithChildren<{}>) {
  const api = Model.useAssistantAPI()

  return (
    <>
      {children}
      <RightSidebar
        onQurator={api?.show || (() => {})}
        quratorActive={api?.visible || false}
        contextUsagePercent={undefined} // Token usage tracking not yet implemented
      />
      <Sidebar />
    </>
  )
}
