import * as React from 'react'

// Whether a clamped element's content overflows its box. `active` gates
// measurement so an expanded (unclamped) element keeps its last result instead
// of reporting no overflow.
export function useContentOverflows(
  ref: React.RefObject<HTMLElement>,
  active: boolean,
  deps: React.DependencyList,
): boolean {
  const [overflows, setOverflows] = React.useState(false)
  React.useLayoutEffect(() => {
    if (!active) return undefined
    const el = ref.current
    if (!el) return undefined
    const measure = () => setOverflows(el.scrollHeight > el.clientHeight)
    measure()
    // Recompute when the content reflows (e.g. images load, viewport resizes).
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])
  return overflows
}
