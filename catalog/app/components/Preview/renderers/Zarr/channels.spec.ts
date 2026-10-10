import { describe, expect, it, vi } from 'vitest'

import { channelsFromMetadata, defaultPlane, MAX_CHANNELS, onBaseGrid } from './channels'

describe('components/Preview/renderers/Zarr/channels', () => {
  it('reads label, colour, visibility and window from omero metadata', () => {
    const [c] = channelsFromMetadata(
      {
        channels: [
          {
            label: 'LaminB1',
            color: '0000FF',
            active: false,
            window: { start: 0, end: 1500 },
          },
        ],
      },
      1,
    )
    expect(c).toEqual({
      index: 0,
      label: 'LaminB1',
      color: [0, 0, 255],
      visible: false,
      contrastLimits: [0, 1500],
    })
  })

  it('falls back when metadata is absent or degenerate', () => {
    const [c] = channelsFromMetadata({ channels: [{ window: { start: 5, end: 5 } }] }, 1)
    expect(c.label).toBe('Channel 0')
    expect(c.visible).toBe(true)
    expect(c.contrastLimits).toBeUndefined()
    expect(channelsFromMetadata(undefined, 2)).toHaveLength(2)
  })

  it('caps channels at what Viv can shade', () => {
    expect(channelsFromMetadata(undefined, 20)).toHaveLength(MAX_CHANNELS)
  })

  it('keeps active channels when capping', () => {
    const channels = Array.from({ length: 8 }, (_, i) => ({ active: i >= 6 }))
    const picked = channelsFromMetadata({ channels }, 8)
    expect(picked.map((c) => c.index)).toEqual([0, 1, 2, 3, 6, 7])
    expect(picked.filter((c) => c.visible)).toHaveLength(2)
  })

  it('opens on the rdefs default plane, clamped to the array', () => {
    const labels = ['c', 'z', 'y', 'x']
    const shape = [2, 236, 275, 271]
    expect(defaultPlane({ rdefs: { defaultZ: 118 } }, shape, labels)).toEqual({
      z: 118,
      t: 0,
    })
    expect(defaultPlane({ rdefs: { defaultZ: 999 } }, shape, labels)).toEqual({
      z: 235,
      t: 0,
    })
    expect(defaultPlane(undefined, shape, labels)).toEqual({ z: 0, t: 0 })
  })

  it('scales the full-resolution plane onto a level that downsamples z', async () => {
    const labels = ['c', 'z', 'y', 'x']
    const base = { labels, shape: [2, 236, 4, 4], getTile: vi.fn(), getRaster: vi.fn() }
    const getRaster = vi.fn(async (p: unknown) => p)
    const low = onBaseGrid({ ...base, shape: [2, 30, 1, 1], getRaster }, base)
    expect(low.shape).toEqual([2, 30, 1, 1])
    await low.getRaster({ selection: { c: 1, z: 118 } })
    expect(getRaster).toHaveBeenCalledWith({ selection: { c: 1, z: 15 } })
  })

  it('indexes each shape by its own labels and passes unknown keys through', async () => {
    const base = {
      labels: ['c', 'z', 'y', 'x'],
      shape: [2, 236, 4, 4],
      getTile: vi.fn(),
      getRaster: vi.fn(),
    }
    const getRaster = vi.fn(async (p: unknown) => p)
    const low = onBaseGrid(
      { labels: ['z', 'c', 'y', 'x'], shape: [30, 2, 1, 1], getTile: vi.fn(), getRaster },
      base,
    )
    await low.getRaster({ selection: { c: 1, z: 118, t: 3 } })
    expect(getRaster).toHaveBeenCalledWith({ selection: { c: 1, z: 15, t: 3 } })
  })
})
