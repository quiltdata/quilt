import { describe, expect, it } from 'vitest'

import { MAX_ICON_DATA_URL_LENGTH, clampArea, pickUnderBudget } from './iconCrop'

describe('containers/Admin/Buckets/iconCrop', () => {
  describe('clampArea', () => {
    const media = { width: 200, height: 100 }

    it('passes an in-bounds area through, rounded', () => {
      expect(clampArea({ x: 10.4, y: 20.6, width: 50.2, height: 30.8 }, media)).toEqual({
        x: 10,
        y: 21,
        width: 50,
        height: 31,
      })
    })

    it('pulls a negative origin back to zero without keeping the overshoot', () => {
      // A crop panned past the left edge: drawImage would read the negative
      // strip as transparent and leave a hairline down the disc.
      const clamped = clampArea({ x: -8, y: -3, width: 60, height: 60 }, media)
      expect(clamped).toEqual({ x: 0, y: 0, width: 60, height: 60 })
    })

    it('trims an area that runs past the right and bottom edges', () => {
      expect(clampArea({ x: 180, y: 80, width: 60, height: 60 }, media)).toEqual({
        x: 180,
        y: 80,
        width: 20,
        height: 20,
      })
    })

    it('rejects an area that leaves nothing to draw', () => {
      expect(clampArea({ x: 200, y: 0, width: 40, height: 40 }, media)).toBeNull()
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

    it('returns the smallest candidate when none fit, rather than blocking a save', () => {
      expect(pickUnderBudget([of(100), of(70), of(90)], 50)).toHaveLength(70)
    })

    it('skips candidates that encode to nothing', () => {
      expect(pickUnderBudget([() => '', of(10)], 50)).toHaveLength(10)
    })

    it('has nothing to return with no candidates', () => {
      expect(pickUnderBudget([], 50)).toBeNull()
    })
  })

  it('budgets an inline icon small enough to ship in every buckets query', () => {
    // BucketConfig.iconUrl is read on the volumes landing for every bucket at
    // once, so the per-bucket ceiling has to stay in kilobytes.
    expect(MAX_ICON_DATA_URL_LENGTH).toBeLessThanOrEqual(16 * 1024)
  })
})
