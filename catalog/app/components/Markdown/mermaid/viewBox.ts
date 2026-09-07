export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Point {
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 8

export const STEP = 1.4

export function parse(attr: string | null): ViewBox | null {
  if (!attr) return null
  const parts = attr
    .trim()
    .split(/[\s,]+/)
    .map(Number)
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null
  const [x, y, w, h] = parts
  if (w <= 0 || h <= 0) return null
  return { x, y, w, h }
}

export const format = ({ x, y, w, h }: ViewBox) => `${x} ${y} ${w} ${h}`

/** How much closer the view is than the whole diagram: 1 is fit, 2 is twice as close. */
export const scaleOf = (base: ViewBox, view: ViewBox) => base.w / view.w

export const isFit = (base: ViewBox, view: ViewBox) =>
  scaleOf(base, view) <= MIN_SCALE + 1e-9

/** Hold the view inside the diagram, so panning cannot reach empty space. */
export function clamp(base: ViewBox, view: ViewBox): ViewBox {
  const w = Math.min(view.w, base.w)
  const h = Math.min(view.h, base.h)
  return {
    w,
    h,
    x: Math.min(Math.max(view.x, base.x), base.x + base.w - w),
    y: Math.min(Math.max(view.y, base.y), base.y + base.h - h),
  }
}

export const clampScale = (scale: number) =>
  Math.min(Math.max(scale, MIN_SCALE), MAX_SCALE)

/**
 * Zoom by `factor`, keeping the diagram point `at` under the same pixel.
 *
 * `at` is in diagram (viewBox) units — the caller maps a cursor position through
 * the SVG's own CTM, which accounts for however the SVG is letterboxed.
 */
export function zoomAbout(
  base: ViewBox,
  view: ViewBox,
  at: Point,
  factor: number,
): ViewBox {
  const scale = clampScale(scaleOf(base, view) * factor)
  const w = base.w / scale
  const h = base.h / scale
  const fx = (at.x - view.x) / view.w
  const fy = (at.y - view.y) / view.h
  return clamp(base, { w, h, x: at.x - w * fx, y: at.y - h * fy })
}

/** Move the view by a delta in diagram units. */
export const panBy = (base: ViewBox, view: ViewBox, dx: number, dy: number): ViewBox =>
  clamp(base, { ...view, x: view.x - dx, y: view.y - dy })

export const center = (view: ViewBox): Point => ({
  x: view.x + view.w / 2,
  y: view.y + view.h / 2,
})
