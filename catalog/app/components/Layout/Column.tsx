import * as React from 'react'
import * as M from '@material-ui/core'
import createBreakpoints, { Breakpoint } from '@material-ui/core/styles/createBreakpoints'

/**
 * Page layouts respond to the width they actually get -- the main column,
 * i.e. the viewport minus the rail minus the Qurator panel -- not the
 * viewport. `Layout` names its main column as a CSS size container, and these
 * mirror `theme.breakpoints` against it, so a site swaps one for the other.
 *
 * Anything rendered through a portal (Dialog, Popover, Menu, Drawer) sits
 * outside the container: it keeps `theme.breakpoints`. So does the column
 * element itself -- a container query only ever matches an ancestor.
 */
export const NAME = 'main'

// MUI's own semantics (down('sm') is max-width 959.95px, down('xl') is
// everything), retargeted from the viewport to the column.
const bp = createBreakpoints({})
const retarget = (media: string) => media.replace('@media', `@container ${NAME}`)

// A number passes through to the same threshold MUI would emit, so a layout
// tuned to a pixel width keeps that width instead of being rounded to a band.
export const up = (key: Breakpoint | number) => retarget(bp.up(key))
export const down = (key: Breakpoint | number) => retarget(bp.down(key))

const KEYS = bp.keys

const bandOf = (width: number): Breakpoint => {
  let band: Breakpoint = 'xs'
  for (const k of KEYS) if (width >= bp.values[k]) band = k
  return band
}

// `null` outside a measured column (bare pages, tests without ResizeObserver):
// the hooks then fall back to the viewport, which is what those cases mean.
const Ctx = React.createContext<Breakpoint | null>(null)

const ElCtx = React.createContext<HTMLElement | null>(null)

/**
 * The main column element. `.main` is the scroll container, not the window, so
 * anything reading or setting scroll position has to address this instead.
 */
export const useElement = () => React.useContext(ElCtx)

interface ProviderProps {
  // The element, not a ref: a parent's ref is attached after its children's
  // layout effects run, so a ref read there is still null.
  target: HTMLElement | null
  children: React.ReactNode
}

/** Publishes the breakpoint band of `target`'s width; state only changes when the band does. */
export function Provider({ target, children }: ProviderProps) {
  const [band, setBand] = React.useState<Breakpoint | null>(null)
  React.useLayoutEffect(() => {
    if (!target || typeof ResizeObserver === 'undefined') return
    // No seed: observing fires the callback immediately, and its `contentRect`
    // is the box a `container-type: inline-size` query resolves against --
    // `clientWidth` would include padding and disagree with the stylesheet.
    const ro = new ResizeObserver(([entry]) => {
      // A throw here kills every later delivery, so the column would freeze at
      // whatever band it last saw: an empty batch is spec-legal.
      if (entry) setBand(bandOf(entry.contentRect.width))
    })
    ro.observe(target)
    return () => ro.disconnect()
  }, [target])
  return (
    <ElCtx.Provider value={target}>
      <Ctx.Provider value={band}>{children}</Ctx.Provider>
    </ElCtx.Provider>
  )
}

/** Column-width twin of `useMediaQuery(theme.breakpoints.down(key))`. */
export function useDown(key: Breakpoint): boolean {
  const band = React.useContext(Ctx)
  const t = M.useTheme()
  const viewport = M.useMediaQuery(t.breakpoints.down(key))
  return band === null ? viewport : KEYS.indexOf(band) <= KEYS.indexOf(key)
}
