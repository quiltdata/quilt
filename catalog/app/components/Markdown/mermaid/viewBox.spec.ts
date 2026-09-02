import { describe, expect, it } from 'vitest'

import * as VB from './viewBox'

const BASE: VB.ViewBox = { x: 0, y: 0, w: 100, h: 50 }

describe('components/Markdown/mermaid/viewBox', () => {
  describe('parse', () => {
    it('reads a viewBox attribute', () => {
      expect(VB.parse('0 0 100 50')).toEqual(BASE)
    })

    it('accepts comma and multi-space separators, and negative origins', () => {
      expect(VB.parse('-8,-4, 100,  50')).toEqual({ x: -8, y: -4, w: 100, h: 50 })
    })

    it('accepts fractional values, which mermaid emits', () => {
      expect(VB.parse('0 0 100.5 50.25')).toEqual({ x: 0, y: 0, w: 100.5, h: 50.25 })
    })

    it('rejects anything that is not four finite numbers', () => {
      expect(VB.parse(null)).toBeNull()
      expect(VB.parse('')).toBeNull()
      expect(VB.parse('0 0 100')).toBeNull()
      expect(VB.parse('0 0 100 50 7')).toBeNull()
      expect(VB.parse('0 0 abc 50')).toBeNull()
    })

    it('rejects a degenerate box, which would make scale division meaningless', () => {
      expect(VB.parse('0 0 0 50')).toBeNull()
      expect(VB.parse('0 0 100 -50')).toBeNull()
    })
  })

  describe('zoomAbout', () => {
    it('holds the anchor point still', () => {
      const at = { x: 25, y: 10 }
      const next = VB.zoomAbout(BASE, BASE, at, 2)
      // The anchor must sit at the same fraction across the box before and after,
      // which is what "the point under the cursor does not move" means.
      expect((at.x - next.x) / next.w).toBeCloseTo((at.x - BASE.x) / BASE.w, 6)
      expect((at.y - next.y) / next.h).toBeCloseTo((at.y - BASE.y) / BASE.h, 6)
    })

    it('zooms in by the factor', () => {
      const next = VB.zoomAbout(BASE, BASE, VB.center(BASE), 2)
      expect(VB.scaleOf(BASE, next)).toBeCloseTo(2, 6)
    })

    it('keeps the diagram aspect ratio', () => {
      const next = VB.zoomAbout(BASE, BASE, { x: 10, y: 40 }, 3)
      expect(next.w / next.h).toBeCloseTo(BASE.w / BASE.h, 6)
    })

    it('will not zoom out past a fit view', () => {
      const next = VB.zoomAbout(BASE, BASE, VB.center(BASE), 1 / 4)
      expect(next).toEqual(BASE)
      expect(VB.isFit(BASE, next)).toBe(true)
    })

    it('caps zooming in', () => {
      let view = BASE
      for (let i = 0; i < 20; i++) view = VB.zoomAbout(BASE, view, VB.center(view), 2)
      expect(VB.scaleOf(BASE, view)).toBeCloseTo(VB.MAX_SCALE, 6)
    })

    it('stays inside the diagram when anchored at a corner', () => {
      const next = VB.zoomAbout(BASE, BASE, { x: 0, y: 0 }, 2)
      expect(next.x).toBeGreaterThanOrEqual(BASE.x)
      expect(next.y).toBeGreaterThanOrEqual(BASE.y)
      expect(next.x + next.w).toBeLessThanOrEqual(BASE.x + BASE.w + 1e-9)
      expect(next.y + next.h).toBeLessThanOrEqual(BASE.y + BASE.h + 1e-9)
    })

    it('round-trips back to fit', () => {
      const at = { x: 70, y: 30 }
      const inThenOut = VB.zoomAbout(
        BASE,
        VB.zoomAbout(BASE, BASE, at, VB.STEP),
        at,
        1 / VB.STEP,
      )
      expect(inThenOut.w).toBeCloseTo(BASE.w, 6)
      expect(inThenOut.h).toBeCloseTo(BASE.h, 6)
    })
  })

  describe('panBy', () => {
    const zoomed = VB.zoomAbout(BASE, BASE, VB.center(BASE), 2)

    it('moves opposite the drag, so content follows the cursor', () => {
      const next = VB.panBy(BASE, zoomed, 10, 5)
      expect(next.x).toBeCloseTo(zoomed.x - 10, 6)
      expect(next.y).toBeCloseTo(zoomed.y - 5, 6)
    })

    it('cannot pan past the edges into empty space', () => {
      const far = VB.panBy(BASE, zoomed, -1e6, -1e6)
      expect(far.x + far.w).toBeCloseTo(BASE.x + BASE.w, 6)
      expect(far.y + far.h).toBeCloseTo(BASE.y + BASE.h, 6)
      const near = VB.panBy(BASE, zoomed, 1e6, 1e6)
      expect(near.x).toBeCloseTo(BASE.x, 6)
      expect(near.y).toBeCloseTo(BASE.y, 6)
    })

    it('does not move a fit view, which has nowhere to go', () => {
      expect(VB.panBy(BASE, BASE, 25, 25)).toEqual(BASE)
    })

    it('honours a negative origin', () => {
      const base: VB.ViewBox = { x: -50, y: -20, w: 100, h: 50 }
      const view = VB.zoomAbout(base, base, VB.center(base), 2)
      const far = VB.panBy(base, view, 1e6, 1e6)
      expect(far.x).toBeCloseTo(base.x, 6)
      expect(far.y).toBeCloseTo(base.y, 6)
    })
  })

  describe('isFit', () => {
    it('is true at fit and false once zoomed', () => {
      expect(VB.isFit(BASE, BASE)).toBe(true)
      expect(VB.isFit(BASE, VB.zoomAbout(BASE, BASE, VB.center(BASE), 2))).toBe(false)
    })

    it('tolerates float drift from a zoom round-trip', () => {
      const at = { x: 33, y: 17 }
      let view = BASE
      for (let i = 0; i < 5; i++) view = VB.zoomAbout(BASE, view, at, VB.STEP)
      for (let i = 0; i < 5; i++) view = VB.zoomAbout(BASE, view, at, 1 / VB.STEP)
      expect(VB.isFit(BASE, view)).toBe(true)
    })
  })

  describe('format', () => {
    it('round-trips through parse', () => {
      const view = VB.zoomAbout(BASE, BASE, { x: 12, y: 34 }, VB.STEP)
      expect(VB.parse(VB.format(view))).toEqual(view)
    })
  })
})
