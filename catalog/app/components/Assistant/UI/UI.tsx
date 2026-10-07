import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as HubSpot from 'components/HubSpot'
import * as style from 'constants/style'

import * as Model from '../Model'
import Chat from './Chat'
import Help from './Help'
import * as InlinePresence from './InlinePresence'
import {
  DRAGGING,
  MOTION,
  PANEL_WIDTH,
  RAIL_WIDTH,
  STILL,
  Context as ReflowContext,
} from './PanelReflow'

// The rail button names the region it expands, so both need one id. The paper
// carries it, not the chat: the chat unmounts in the very state where the
// button names it, and `aria-controls` must resolve to something on screen.
const PANEL_ID = 'qurator-panel'

const MIN_WIDTH = 320
const MAX_VW = 70
// The expanded left rail (256px) plus the content column the default panel
// leaves at the docking breakpoint: a wider panel squeezes the page to nothing.
const RESERVE = 480
const STEP = 32
const WIDTH_KEY = 'QURATOR_PANEL_WIDTH'

const clampWidth = (px: number, viewport: number) =>
  Math.round(
    Math.max(MIN_WIDTH, Math.min(px, (viewport * MAX_VW) / 100, viewport - RESERVE)),
  )

// The CSS clamp re-applies the bounds as the viewport changes after a resize.
const widthCss = (px: number | null) =>
  px == null
    ? PANEL_WIDTH
    : `clamp(${MIN_WIDTH}px, ${px}px, min(${MAX_VW}vw, 100vw - ${RESERVE}px))`

// Private windows and blocked site data make `localStorage` throw on access.
function loadWidth(): number | null {
  try {
    const px = Number(localStorage.getItem(WIDTH_KEY))
    return Number.isFinite(px) && px > 0 ? px : null
  } catch {
    return null
  }
}

function saveWidth(px: number) {
  try {
    localStorage.setItem(WIDTH_KEY, String(px))
  } catch {
    // Unpersisted, the width still holds for this page load.
  }
}

// `PANEL_WIDTH` in pixels, for the separator's value before any resize.
function defaultWidth() {
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
  return Math.round(Math.min(40 * rem, window.innerWidth / 2))
}

function usePanelWidth() {
  const [width, setWidth] = React.useState(loadWidth)
  const resize = React.useCallback((px: number, persist = true) => {
    const clamped = clampWidth(px, window.innerWidth)
    setWidth(clamped)
    if (persist) saveWidth(clamped)
  }, [])
  return [width, resize] as const
}

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
    [STILL]: { transition: 'none' },
  },
  paperRail: {
    width: RAIL_WIDTH,
  },
  // The overlay is the whole panel on a phone; the docked paper stops at the
  // gutter. `&&` (0,2,0) is what beats `paper`'s own width -- at equal
  // specificity the winner would be JSS injection order, so reordering these
  // keys would put a phone back on the docked `min(40rem, 50vw)`.
  paperCompact: {
    '&&': {
      paddingBottom: 'env(safe-area-inset-bottom)',
      paddingRight: 'env(safe-area-inset-right)',
      width: 'min(40rem, 100vw)',
    },
  },
  resizer: {
    bottom: 0,
    cursor: 'col-resize',
    left: 0,
    position: 'absolute',
    top: 0,
    touchAction: 'none',
    width: t.spacing(1),
    zIndex: 2,
    // A grip at rest: the edge must not be an affordance only on hover.
    '&::after': {
      background: t.palette.text.disabled,
      borderRadius: 1,
      content: '""',
      height: t.spacing(4),
      left: 3,
      marginTop: t.spacing(-2),
      position: 'absolute',
      top: '50%',
      width: 2,
    },
    '&:hover::after, &:focus-visible::after': {
      background: t.palette.primary.main,
    },
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
  rail: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    paddingTop: t.spacing(1),
  },
}))

interface ResizerProps {
  className: string
  width: number | null
  onResize: (px: number, persist?: boolean) => void
}

function Resizer({ className, width, onResize }: ResizerProps) {
  // The pointer that started the drag: a second touch must not move or end it.
  const dragging = React.useRef<number | null>(null)
  const dragged = React.useRef<number | null>(null)
  const drag = (pointer: number | null) => {
    if (pointer == null && dragging.current != null && dragged.current != null)
      onResize(dragged.current)
    dragging.current = pointer
    dragged.current = null
    document.body.toggleAttribute(DRAGGING, pointer != null)
  }
  // Escape collapses the panel mid-drag and unmounts this; keep what was dragged.
  React.useEffect(() => () => drag(null), []) // eslint-disable-line react-hooks/exhaustive-deps
  // `now` and the max read the viewport, which the CSS clamp follows unprompted.
  const [, rerender] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    window.addEventListener('resize', rerender)
    return () => window.removeEventListener('resize', rerender)
  }, [])
  const now = clampWidth(width ?? defaultWidth(), window.innerWidth)
  // The paper is anchored right, so its width is its right edge minus the pointer.
  const edge = (el: HTMLElement) => el.parentElement!.getBoundingClientRect().right
  return (
    <div
      className={className}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Qurator"
      aria-controls={PANEL_ID}
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={clampWidth(Infinity, window.innerWidth)}
      aria-valuenow={now}
      tabIndex={0}
      onPointerDown={(e) => {
        if (e.button !== 0 || dragging.current != null) return
        e.preventDefault()
        // Without capture a release outside the handle never arrives, so a
        // drag that cannot capture does not start.
        try {
          e.currentTarget.setPointerCapture?.(e.pointerId)
        } catch {
          return
        }
        drag(e.pointerId)
      }}
      onPointerMove={(e) => {
        if (dragging.current !== e.pointerId) return
        dragged.current = edge(e.currentTarget) - e.clientX
        onResize(dragged.current, false)
      }}
      // A cancelled pointer never sends `pointerup`; without this the drag
      // would outlive the press and resize on plain hover.
      onLostPointerCapture={(e) => dragging.current === e.pointerId && drag(null)}
      onPointerUp={(e) => dragging.current === e.pointerId && drag(null)}
      onKeyDown={(e) => {
        const next = {
          ArrowLeft: now + STEP,
          ArrowRight: now - STEP,
          Home: MIN_WIDTH,
          End: Infinity,
        }[e.key]
        if (next == null) return
        e.preventDefault()
        onResize(next)
      }}
    />
  )
}

type Help = NonNullable<ReturnType<typeof HubSpot.useChat>>

interface PanelProps {
  api: ReturnType<typeof Model.useAssistantAPI> | null
  help: Help | null
  // Which face the panel shows; `null` is the collapsed rail.
  mode: 'qurator' | 'help' | null
  compact: boolean
  width: number | null
  onResize: (px: number, persist?: boolean) => void
}

// A drag re-renders the panel on every move; the conversation needn't follow.
const MemoChat = React.memo(Chat)

const noop = () => {}

function Panel({ api, help, mode, compact, width, onResize }: PanelProps) {
  const classes = usePanelStyles()
  const instant = useInstant()
  const quratorRef = React.useRef<HTMLButtonElement>(null)
  const helpRef = React.useRef<HTMLButtonElement>(null)
  // Collapsing hands focus back to the rail button of the face that was open.
  const lastMode = React.useRef(mode)
  if (mode) lastMode.current = mode
  const open = mode != null
  const hide = (mode === 'help' ? help?.hide : api?.hide) ?? noop
  useEscapeToCollapse(open && !compact, hide)
  // Above the breakpoint Qurator is furniture like the left rail: `permanent`
  // renders no Slide and ignores `open`, so the panel narrows to a rail
  // instead of leaving. Below it, a rail plus a 40rem panel both lose, so the
  // old overlay stands.
  const expanded = compact || open
  useFocusRail(!compact, open, lastMode.current === 'help' ? helpRef : quratorRef)
  return (
    <M.MuiThemeProvider theme={style.appTheme}>
      <M.Drawer
        anchor="right"
        variant={compact ? 'temporary' : 'permanent'}
        open={open}
        onClose={hide}
        PaperProps={{
          id: PANEL_ID,
          style: open && !compact ? { width: widthCss(width) } : undefined,
        }}
        classes={{
          paper: cx(
            classes.paper,
            !expanded && classes.paperRail,
            compact && classes.paperCompact,
          ),
        }}
        // `timeout` overrides the Drawer's own Slide duration -- it spreads
        // SlideProps last.
        SlideProps={{ timeout: instant ? 0 : undefined }}
      >
        {open && !compact && (
          <Resizer className={classes.resizer} width={width} onResize={onResize} />
        )}
        {expanded && mode === 'help' && help ? (
          <Help onClose={help.hide} />
        ) : expanded && api ? (
          <MemoChat
            state={api.state}
            dispatch={api.dispatch}
            devTools={api.devTools}
            sessions={api.sessions}
            connectors={api.connectors}
            instructions={api.instructions}
            model={api.model}
            busy={api.busy}
            onClose={api.hide}
          />
        ) : (
          <div className={classes.rail}>
            {/* One string for both, as the rail's own rows do: the tooltip is
                the sighted user's copy of the accessible name. */}
            {api && (
              <M.Tooltip title="Ask Qurator" placement="left">
                <M.IconButton
                  ref={quratorRef}
                  onClick={api.show}
                  aria-label="Ask Qurator"
                  aria-expanded={false}
                  aria-controls={PANEL_ID}
                >
                  <M.Icon>auto_awesome</M.Icon>
                </M.IconButton>
              </M.Tooltip>
            )}
            {help && (
              <M.Tooltip title="Help" placement="left">
                <M.IconButton
                  ref={helpRef}
                  onClick={help.show}
                  aria-label="Help"
                  aria-expanded={false}
                  aria-controls={PANEL_ID}
                >
                  <M.Icon>support_agent</M.Icon>
                </M.IconButton>
              </M.Tooltip>
            )}
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
  // Help (HubSpot chat) is the panel's second face: one dock, one width, one
  // face at a time -- opening either closes the other.
  const help = HubSpot.useChat()
  const helpOpen = !!help?.open
  const visible = !!api?.visible
  // An inlined chat replaces the panel outright -- a docked rail would take a
  // gutter for a second copy of the same conversation.
  const qurator = !!api && !inlined
  // Layout effects, so the face being closed never paints for a frame. Only the
  // docked Qurator competes for the panel: an inline chat leaves Help alone.
  React.useLayoutEffect(() => {
    if (helpOpen && visible && qurator) api?.hide()
  }, [helpOpen]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useLayoutEffect(() => {
    if (visible && qurator) help?.hide()
  }, [visible, qurator]) // eslint-disable-line react-hooks/exhaustive-deps
  const present = qurator || !!help
  const mode = helpOpen ? 'help' : qurator && visible ? 'qurator' : null
  const [width, resize] = usePanelWidth()
  return (
    <ReflowContext.Provider
      value={present && !compact ? (mode ? widthCss(width) : RAIL_WIDTH) : null}
    >
      {children}
      {present && (
        <Panel
          api={qurator ? api : null}
          help={help}
          mode={mode}
          compact={compact}
          width={width}
          onResize={resize}
        />
      )}
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
