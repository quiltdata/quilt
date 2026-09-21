import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import * as InlinePresence from './InlinePresence'
import { PANEL_WIDTH, Context as ReflowContext } from './PanelReflow'

export * from './PanelReflow'

// The left rail drops to an overlay at the same threshold: under 960px a
// 40rem panel would leave no content column to reflow.
const useCompact = () => {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

const usePanelStyles = M.makeStyles((t) => ({
  paper: {
    background: t.palette.background.default,
    // Docked paper carries no divider of its own; the hairline is what makes
    // the panel read as chrome against the content it pushed aside.
    borderLeft: `1px solid ${t.palette.divider}`,
    display: 'flex',
    width: PANEL_WIDTH,
  },
}))

interface PanelProps {
  api: NonNullable<ReturnType<typeof Model.useAssistantAPI>>
  compact: boolean
  open: boolean
}

function Panel({ api, compact, open }: PanelProps) {
  const classes = usePanelStyles()
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer
        anchor="right"
        variant={compact ? 'temporary' : 'persistent'}
        open={open}
        onClose={api.hide}
        classes={{ paper: classes.paper }}
        // A persistent drawer stays in the tree when closed; without this its
        // contents keep their tab stops offscreen.
        SlideProps={{ unmountOnExit: true }}
      >
        <Chat
          state={api.state}
          dispatch={api.dispatch}
          devTools={api.devTools}
          connectors={api.connectors}
          instructions={api.instructions}
          onClose={api.hide}
        />
      </M.Drawer>
    </M.MuiThemeProvider>
  )
}

// `children` is passed straight through: React bails out on an identical
// element reference, so chat state churn here doesn't re-render the app.
function Host({ children }: React.PropsWithChildren<{}>) {
  const api = Model.useAssistantAPI()
  const inlined = InlinePresence.useInlined()
  const compact = useCompact()
  const open = !!api && api.visible && !inlined
  return (
    <ReflowContext.Provider value={open && !compact}>
      {children}
      {!!api && <Panel api={api} compact={compact} open={open} />}
    </ReflowContext.Provider>
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
      <M.Icon>auto_awesome</M.Icon>
    </M.IconButton>
  )
}

export function WithAssistantUI({ children }: React.PropsWithChildren<{}>) {
  return (
    <InlinePresence.Provider>
      <Host>{children}</Host>
    </InlinePresence.Provider>
  )
}
