import * as React from 'react'
import * as M from '@material-ui/core'

// Below this the chat's input and header controls start to wrap.
export const MIN_WIDTH = 320
// At most 900px, and at most 60vw so the page keeps the larger share.
const maxWidth = () => Math.min(0.6 * window.innerWidth, 900)
const STEP = 16
const KEY = 'QUILT_QURATOR_PANEL_WIDTH'
const VAR = '--qurator-panel-width'

export const clamp = (px: number) =>
  Math.round(Math.max(MIN_WIDTH, Math.min(px, maxWidth())))

function readStored(): number | null {
  try {
    const n = Number(localStorage.getItem(KEY))
    return Number.isFinite(n) && n > 0 ? n : null
  } catch {
    return null
  }
}

function store(px: number) {
  try {
    localStorage.setItem(KEY, String(px))
  } catch {
    // Unavailable storage only costs remembering the width.
  }
}

// CSS clamps again, so a stored width outlives a smaller window without a
// resize listener.
function apply(px: number | null) {
  const root = document.documentElement.style
  if (px == null) root.removeProperty(VAR)
  else root.setProperty(VAR, `clamp(${MIN_WIDTH}px, ${px}px, min(60vw, 900px))`)
}

const useStyles = M.makeStyles((t) => ({
  handle: {
    bottom: 0,
    cursor: 'col-resize',
    left: 0,
    position: 'absolute',
    top: 0,
    touchAction: 'none',
    width: 6,
    zIndex: 2,
    '&:hover, &:focus-visible': {
      background: t.palette.divider,
    },
    // The Focus Ring Rule (DESIGN.md §2), light half: midnight on white.
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.main}`,
      outlineOffset: -2,
    },
  },
}))

// The paper's own default, `min(40rem, 50vw)`, computed rather than measured:
// a measurement taken while the paper animates open reads its start width.
const defaultWidth = () => clamp(Math.min(640, window.innerWidth / 2))

// Excludes a classic scrollbar, which `innerWidth` counts.
const viewportWidth = () => document.documentElement.clientWidth || window.innerWidth

/** Drag or arrow-key handle on the docked panel's left edge. */
export function ResizeHandle() {
  const classes = useStyles()
  const [width, setWidth] = React.useState(() => readStored())
  // Re-read on focus and on window resize, so the values announced follow the
  // window's current size.
  const [, refresh] = React.useReducer((n: number) => n + 1, 0)
  React.useEffect(() => {
    window.addEventListener('resize', refresh)
    return () => window.removeEventListener('resize', refresh)
  }, [])

  React.useEffect(() => {
    apply(width)
  }, [width])

  const current = () => clamp(width ?? defaultWidth())

  const commit = (px: number) => {
    const next = clamp(px)
    setWidth(next)
    store(next)
  }

  // Ends a drag the handle can no longer finish itself: unmounted mid-drag (the
  // panel collapsed on Escape), or the pointer capture lost.
  const endDrag = React.useRef<(() => void) | null>(null)
  React.useEffect(() => () => endDrag.current?.(), [])

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    document.body.setAttribute('data-qurator-resizing', '')
    const userSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    let px = current()
    let moved = false
    // The panel's right edge is the viewport's, so the width is the distance
    // from the pointer to that edge. Written straight to the CSS variable:
    // no React render per frame.
    const move = (ev: PointerEvent) => {
      moved = true
      px = clamp(viewportWidth() - ev.clientX)
      apply(px)
    }
    const finish = (save: (px: number) => void) => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      el.removeEventListener('lostpointercapture', up)
      endDrag.current = null
      document.body.removeAttribute('data-qurator-resizing')
      document.body.style.userSelect = userSelect
      // A click without a drag must not pin the responsive default.
      if (moved) save(px)
    }
    const up = () => finish(commit)
    endDrag.current = () => finish(store)
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
    el.addEventListener('lostpointercapture', up)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const px = current()
    const next = {
      ArrowLeft: px + STEP,
      ArrowRight: px - STEP,
      Home: MIN_WIDTH,
      End: maxWidth(),
    }[e.key]
    if (next == null) return
    e.preventDefault()
    commit(next)
  }

  return (
    <div
      className={classes.handle}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Qurator panel"
      aria-valuemin={MIN_WIDTH}
      aria-valuemax={Math.round(maxWidth())}
      aria-valuenow={current()}
      tabIndex={0}
      onFocus={refresh}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
