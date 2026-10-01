import { describe, expect, it } from 'vitest'

import { detect, isImage } from './zarrDetect'

describe('components/Preview/loaders/Zarr', () => {
  it.each(['img.zarr/.zattrs', 'a/b/IMG.ZARR/zarr.json'])('detects %s', (key) => {
    expect(detect(key)).toBe(true)
  })

  it.each(['img.zarr/0/.zarray', 'img.zarr/0/zarr.json', 'zarr.json', 'x/.zattrs'])(
    'ignores %s',
    (key) => {
      expect(detect(key)).toBe(false)
    },
  )

  it('opens the viewer only for multiscale images (v2 or v3 nesting)', () => {
    expect(isImage('{"multiscales": [{"axes": []}]}')).toBe(true)
    expect(isImage('{"attributes": {"ome": {"multiscales": []}}}')).toBe(true)
    expect(isImage('{"zarr_format": 3, "node_type": "group", "attributes": {}}')).toBe(
      false,
    )
    const plate = {
      attributes: { ome: { plate: {} } },
      consolidated_metadata: {
        metadata: { 'A/1/0': { attributes: { ome: { multiscales: [] } } } },
      },
    }
    const plateJson = JSON.stringify(plate)
    expect(isImage(plateJson)).toBe(false)
    expect(isImage(plateJson.slice(0, -10))).toBe(false)
    expect(isImage('{"attributes": {"ome": {"multiscales": [')).toBe(true)
  })
})
