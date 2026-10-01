import { describe, expect, it } from 'vitest'

import { channelsFromMetadata, defaultPlane, MAX_CHANNELS } from './channels'

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
})
