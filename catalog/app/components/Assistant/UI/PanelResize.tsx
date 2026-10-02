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

/** Drag or arrow-key handle on the docked panel's left edge. */
export function ResizeHandle() {
  const classes = useStyles()
  const [width, setWidth] = React.useState(() => readStored())

  React.useEffect(() => {
    apply(width)
  }, [width])

  // Reported to assistive tech only: storing it would pin the responsive
  // default to the width the window happened to have.
  const [measured, setMeasured] = React.useState<number | null>(null)
  React.useLayoutEffect(() => {
    if (width == null) setMeasured(current())
  }, [width]) // eslint-disable-line react-hooks/exhaustive-deps

  const current = () => {
    const paper = document.getElementById('qurator-panel')
    return clamp(width ?? paper?.getBoundingClientRect().width ?? MIN_WIDTH)
  }

  const commit = (px: number) => {
    const next = clamp(px)
    setWidth(next)
    store(next)
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    document.body.setAttribute('data-qurator-resizing', '')
    const userSelect = document.body.style.userSelect
    document.body.style.userSelect = 'none'
    let px = current()
    // The panel's right edge is the viewport's, so the width is the distance
    // from the pointer to that edge. Written straight to the CSS variable:
    // no React render per frame.
    const move = (ev: PointerEvent) => {
      px = clamp(window.innerWidth - ev.clientX)
      apply(px)
    }
    const up = () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerup', up)
      el.removeEventListener('pointercancel', up)
      document.body.removeAttribute('data-qurator-resizing')
      document.body.style.userSelect = userSelect
      commit(px)
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
    el.addEventListener('pointercancel', up)
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
      aria-valuenow={width ?? measured ?? undefined}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
    />
  )
}
