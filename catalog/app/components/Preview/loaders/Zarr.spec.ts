import { describe, expect, it } from 'vitest'

import { detect } from './Zarr'

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
})
