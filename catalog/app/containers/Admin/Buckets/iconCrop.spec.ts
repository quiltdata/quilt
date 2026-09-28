import { describe, expect, it } from 'vitest'

import {
  MAX_ICON_DATA_URL_LENGTH,
  MAX_SOURCE_PIXELS,
  clampArea,
  fitsPixelBudget,
  pickUnderBudget,
} from './iconCrop'

describe('containers/Admin/Buckets/iconCrop', () => {
  describe('clampArea', () => {
    const media = { width: 200, height: 100 }

    it('rounds a fractional in-bounds area to whole pixels', () => {
      expect(clampArea({ x: 10.4, y: 20.6, width: 40.2, height: 40.2 }, media)).toEqual({
        x: 10,
        y: 21,
        width: 40,
        height: 40,
      })
    })

    it('pulls a negative origin back to zero without keeping the overshoot', () => {
      // A crop panned past the left edge: drawImage would read the negative
      // strip as transparent and leave a hairline down the disc.
      expect(clampArea({ x: -8, y: -3, width: 60, height: 60 }, media)).toEqual({
        x: 0,
        y: 0,
        width: 60,
        height: 60,
      })
    })

    it('slides an area that runs past the right and bottom edges back inside', () => {
      // Kept at 60 rather than trimmed to 20: the output is a fixed square, so a
      // trimmed region would be upscaled and reach the admin blurrier than the
      // circle they positioned.
      expect(clampArea({ x: 180, y: 80, width: 60, height: 60 }, media)).toEqual({
        x: 140,
        y: 40,
        width: 60,
        height: 60,
      })
    })

    it('stays square when only one axis overshoots', () => {
      // The caller draws into a fixed square, so an area trimmed on one axis
      // alone would be stretched into it. 20 wide and 60 tall renders as a 3x
      // horizontal stretch with nothing reporting a problem.
      expect(clampArea({ x: 180, y: 0, width: 60, height: 60 }, media)).toEqual({
        x: 140,
        y: 0,
        width: 60,
        height: 60,
      })
      expect(clampArea({ x: 0, y: 60, width: 80, height: 80 }, media)).toEqual({
        x: 0,
        y: 20,
        width: 80,
        height: 80,
      })
    })

    it('shrinks only to the smaller image dimension', () => {
      // The image itself is the floor: 100 tall cannot yield a 150 square.
      expect(clampArea({ x: 0, y: 0, width: 150, height: 150 }, media)).toEqual({
        x: 0,
        y: 0,
        width: 100,
        height: 100,
      })
    })

    it('returns a square for every area it accepts', () => {
      const areas = [
        { x: 0, y: 0, width: 10, height: 90 },
        { x: -40, y: 70, width: 150, height: 150 },
        { x: 199, y: 0, width: 5, height: 99 },
        { x: 12.7, y: 3.2, width: 61.9, height: 8.4 },
      ]
      areas.forEach((a) => {
        const out = clampArea(a, media)
        if (out) expect(out.width).toBe(out.height)
      })
    })

    it('slides an origin past the far edge fully back inside', () => {
      expect(clampArea({ x: 200, y: 0, width: 40, height: 40 }, media)).toEqual({
        x: 160,
        y: 0,
        width: 40,
        height: 40,
      })
    })

    it('rejects an area that leaves nothing to draw', () => {
      expect(clampArea({ x: 0, y: 0, width: 0, height: 40 }, media)).toBeNull()
    })

    it('rejects an image with no dimensions', () => {
      expect(
        clampArea({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 }),
      ).toBeNull()
    })
  })

  describe('pickUnderBudget', () => {
    const of = (len: number) => () => 'x'.repeat(len)

    it('takes the first candidate that fits, leaving later ones unencoded', () => {
      let jpegCalls = 0
      const out = pickUnderBudget(
        [
          of(10),
          () => {
            jpegCalls += 1
            return 'x'.repeat(5)
          },
        ],
        20,
      )
      expect(out).toHaveLength(10)
      expect(jpegCalls).toBe(0)
    })

    it('falls back past a candidate that overshoots the budget', () => {
      expect(pickUnderBudget([of(100), of(30), of(10)], 50)).toHaveLength(30)
    })

    it('refuses rather than returning an oversized encoding', () => {
      // The budget is a bound: the icon is read for every bucket at once on the
      // volumes landing, so handing back the smallest overshoot would defeat it.
      expect(pickUnderBudget([of(100), of(70), of(90)], 50)).toBeNull()
    })

    it('skips candidates that encode to nothing', () => {
      expect(pickUnderBudget([() => '', of(10)], 50)).toHaveLength(10)
    })

    it('has nothing to return with no candidates', () => {
      expect(pickUnderBudget([], 50)).toBeNull()
    })
  })

  describe('fitsPixelBudget', () => {
    it('accepts a source an admin would plausibly pick', () => {
      expect(fitsPixelBudget({ width: 4000, height: 3000 })).toBe(true)
    })

    it('refuses a bitmap whose decode would exhaust the tab', () => {
      // Decode cost is pixels * 4 bytes, so a flat 30000x30000 arrives well under
      // the dropzone's file cap and still decodes to gigabytes.
      expect(fitsPixelBudget({ width: 30000, height: 30000 })).toBe(false)
    })

    it('accepts exactly the budget', () => {
      expect(fitsPixelBudget({ width: MAX_SOURCE_PIXELS, height: 1 })).toBe(true)
      expect(fitsPixelBudget({ width: MAX_SOURCE_PIXELS + 1, height: 1 })).toBe(false)
    })
  })

  it('refuses a candidate over the shipped budget', () => {
    // Asserted through the budget rather than against a copy of its literal: the
    // bound only matters because iconUrl is read for every bucket at once on the
    // volumes landing, and this fails if the constant stops being enforced.
    const over = () => 'x'.repeat(MAX_ICON_DATA_URL_LENGTH + 1)
    const under = () => 'x'.repeat(MAX_ICON_DATA_URL_LENGTH)
    expect(pickUnderBudget([over], MAX_ICON_DATA_URL_LENGTH)).toBeNull()
    expect(pickUnderBudget([under], MAX_ICON_DATA_URL_LENGTH)).toHaveLength(
      MAX_ICON_DATA_URL_LENGTH,
    )
  })
})
