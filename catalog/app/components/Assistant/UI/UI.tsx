import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import * as InlinePresence from './InlinePresence'
import { PANEL_WIDTH, Context as ReflowContext } from './PanelReflow'

// The left rail drops to an overlay at the same threshold: under 960px a
// 40rem panel would leave no content column to reflow.
const useCompact = () => {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

// The gutter Layout holds open can only transition inside this query, so the
// paper has to honour it too -- otherwise the column snaps and the paper slides.
const useInstant = () => M.useMediaQuery('(prefers-reduced-motion: reduce)')

// MUI hands `onClose` to a Modal, which only the `temporary` variant renders:
// the docked panel would otherwise lose the Escape the overlay gave for free.
// Not a focus trap -- the point of a panel that reflows is that the content
// beside it stays usable.
function useEscapeToClose(active: boolean, hide: () => void) {
  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, hide])
}

const usePanelStyles = M.makeStyles((t) => ({
  paper: {
    background: t.palette.background.default,
    width: PANEL_WIDTH,
  },
  // The overlay takes the whole phone; on a tablet it stops at the chat's cap.
  paperCompact: {
    width: 'min(40rem, 100vw)',
  },
}))

interface PanelProps {
  api: NonNullable<ReturnType<typeof Model.useAssistantAPI>>
  compact: boolean
  open: boolean
}

function Panel({ api, compact, open }: PanelProps) {
  const classes = usePanelStyles()
  const instant = useInstant()
  useEscapeToClose(open && !compact, api.hide)
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer
        anchor="right"
        variant={compact ? 'temporary' : 'persistent'}
        open={open}
        onClose={api.hide}
        classes={{ paper: cx(classes.paper, compact && classes.paperCompact) }}
        // A persistent drawer stays in the tree when closed; without this its
        // contents keep their tab stops offscreen. `timeout` overrides the
        // Drawer's own Slide duration -- it spreads SlideProps last.
        SlideProps={{ unmountOnExit: true, timeout: instant ? 0 : undefined }}
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
