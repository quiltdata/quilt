import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import PanelBoundary from 'components/PanelBoundary'
import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import * as InlinePresence from './InlinePresence'
import { MOTION, PANEL_WIDTH, RAIL_WIDTH, Context as ReflowContext } from './PanelReflow'

// The rail button names the region it expands, so both need one id. The paper
// carries it, not the chat: the chat unmounts in the very state where the
// button names it, and `aria-controls` must resolve to something on screen.
const PANEL_ID = 'qurator-panel'

// The left rail drops to an overlay at the same threshold: under 960px a
// 40rem panel would leave no content column to reflow.
const useCompact = () => {
  const t = M.useTheme()
  return M.useMediaQuery(t.breakpoints.down('sm'))
}

// The overlay's Slide gets its transition inline from JS, which no media query
// reaches; the docked paper's width is CSS and honours `MOTION` on its own.
const useInstant = () => M.useMediaQuery('(prefers-reduced-motion: reduce)')

// MUI hands `onClose` to a Modal, which only the `temporary` variant renders:
// the docked panel would otherwise lose the Escape the overlay gave for free.
// Not a focus trap -- the point of a panel that reflows is that the content
// beside it stays usable.
function useEscapeToCollapse(active: boolean, hide: () => void) {
  React.useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, hide])
}

// Collapsing unmounts the chat, and the browser drops focus to `<body>` when the
// focused node goes with it -- so the rail button has to claim it back. Armed
// only by a docked chat that was open: widening past the breakpoint also ends
// `compact`, and focusing there would pull the caret out of whatever has it.
function useFocusRail(docked: boolean, open: boolean, ref: React.RefObject<HTMLElement>) {
  const showedChat = React.useRef(false)
  React.useEffect(() => {
    const showing = docked && open
    if (!showing && showedChat.current) ref.current?.focus()
    showedChat.current = showing
  }, [docked, open, ref])
}

const usePlaceholderStyles = M.makeStyles((t) => ({
  skeletons: {
    display: 'flex',
    flexDirection: 'column',
    gap: t.spacing(2),
  },
}))

function ChatPlaceholder() {
  const classes = usePlaceholderStyles()
  return (
    <div aria-hidden className={classes.skeletons}>
      <Lab.Skeleton height={40} variant="rect" />
      <Lab.Skeleton height={24} width="60%" />
      <Lab.Skeleton height={24} width="80%" />
    </div>
  )
}

const usePanelStyles = M.makeStyles((t) => ({
  paper: {
    background: t.palette.background.default,
    width: PANEL_WIDTH,
    // Width, never transform: the rail has to stay flush against the viewport
    // edge while it narrows, exactly as the left rail does.
    [MOTION]: {
      transition: t.transitions.create('width', {
        duration: t.transitions.duration.enteringScreen,
        easing: t.transitions.easing.easeOut,
      }),
    },
  },
  paperRail: {
    width: RAIL_WIDTH,
  },
  rail: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(1),
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
  const railRef = React.useRef<HTMLButtonElement>(null)
  useEscapeToCollapse(open && !compact, api.hide)
  // Above the breakpoint Qurator is furniture like the left rail: `permanent`
  // renders no Slide and ignores `open`, so the panel narrows to a rail
  // instead of leaving. Below it, a rail plus a 40rem panel both lose, so the
  // old overlay stands.
  const expanded = compact || open
  useFocusRail(!compact, open, railRef)
  // The events Chat renders live above the boundary, so clearing them is what
  // makes Retry able to succeed. Abort first: `Clear` has no transition out of
  // WaitingForAssistant or ToolUse, and an unhandled action leaves the state as
  // it was (utils/Actor.ts), so on its own it would be a no-op mid-request.
  const clearConversation = React.useCallback(() => {
    api.dispatch(Model.Conversation.Action.Abort())
    api.dispatch(Model.Conversation.Action.Clear())
  }, [api])
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer
        anchor="right"
        variant={compact ? 'temporary' : 'permanent'}
        open={open}
        onClose={api.hide}
        PaperProps={{ id: PANEL_ID }}
        classes={{ paper: cx(classes.paper, !expanded && classes.paperRail) }}
        // `timeout` overrides the Drawer's own Slide duration -- it spreads
        // SlideProps last.
        SlideProps={{ timeout: instant ? 0 : undefined }}
      >
        {expanded ? (
          // `plain`, not the default card: the drawer paper already is the panel.
          <PanelBoundary
            title="Qurator could not load"
            retryLabel="Clear and retry"
            variant="plain"
            suspenseFallback={<ChatPlaceholder />}
            busyLabel="Loading Qurator"
            onRetry={clearConversation}
          >
            <Chat
              state={api.state}
              dispatch={api.dispatch}
              devTools={api.devTools}
              connectors={api.connectors}
              instructions={api.instructions}
              onClose={api.hide}
            />
          </PanelBoundary>
        ) : (
          <div className={classes.rail}>
            {/* One string for both, as the rail's own rows do: the tooltip is
                the sighted user's copy of the accessible name. */}
            <M.Tooltip title="Ask Qurator" placement="left">
              <M.IconButton
                ref={railRef}
                onClick={api.show}
                aria-label="Ask Qurator"
                aria-expanded={false}
                aria-controls={PANEL_ID}
              >
                <M.Icon>auto_awesome</M.Icon>
              </M.IconButton>
            </M.Tooltip>
          </div>
        )}
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
  // An inlined chat replaces the panel outright -- a docked rail would take a
  // gutter for a second copy of the same conversation.
  const present = !!api && !inlined
  const open = present && !!api?.visible
  return (
    <ReflowContext.Provider
      value={present && !compact ? (open ? PANEL_WIDTH : RAIL_WIDTH) : null}
    >
      {children}
      {!inlined && api && <Panel api={api} compact={compact} open={open} />}
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
