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

export const up = (key: Breakpoint) => retarget(bp.up(key))
export const down = (key: Breakpoint) => retarget(bp.down(key))
export const between = (start: Breakpoint, end: Breakpoint) =>
  retarget(bp.between(start, end))
export const only = (key: Breakpoint) => retarget(bp.only(key))

const KEYS = bp.keys

const bandOf = (width: number): Breakpoint => {
  let band: Breakpoint = 'xs'
  for (const k of KEYS) if (width >= bp.values[k]) band = k
  return band
}

// `null` outside a measured column (bare pages, tests without ResizeObserver):
// the hooks then fall back to the viewport, which is what those cases mean.
const Ctx = React.createContext<Breakpoint | null>(null)

interface ProviderProps {
  target: React.RefObject<HTMLElement>
  children: React.ReactNode
}

/** Publishes the breakpoint band of `target`'s width; state only changes when the band does. */
export function Provider({ target, children }: ProviderProps) {
  const [band, setBand] = React.useState<Breakpoint | null>(null)
  React.useLayoutEffect(() => {
    const el = target.current
    if (!el || typeof ResizeObserver === 'undefined') return
    setBand(bandOf(el.clientWidth))
    const ro = new ResizeObserver(([entry]) => setBand(bandOf(entry.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [target])
  return <Ctx.Provider value={band}>{children}</Ctx.Provider>
}

/** Column-width twin of `useMediaQuery(theme.breakpoints.down(key))`. */
export function useDown(key: Breakpoint): boolean {
  const band = React.useContext(Ctx)
  const t = M.useTheme()
  const viewport = M.useMediaQuery(t.breakpoints.down(key))
  return band === null ? viewport : KEYS.indexOf(band) <= KEYS.indexOf(key)
}

/** Column-width twin of `useMediaQuery(theme.breakpoints.up(key))`. */
export function useUp(key: Breakpoint): boolean {
  const band = React.useContext(Ctx)
  const t = M.useTheme()
  const viewport = M.useMediaQuery(t.breakpoints.up(key))
  return band === null ? viewport : KEYS.indexOf(band) >= KEYS.indexOf(key)
}
