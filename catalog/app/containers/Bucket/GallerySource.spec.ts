import { describe, expect, it } from 'vitest'

import { resolveGalleryItems } from './GallerySource'

const files = [
  { bucket: 'b', key: 'pkg/images/a.jpg', logicalKey: 'images/a.jpg' },
  { bucket: 'b', key: 'pkg/images/nested/b.png', logicalKey: 'images/nested/b.png' },
  { bucket: 'b', key: 'pkg/images/c.txt', logicalKey: 'images/c.txt' },
  { bucket: 'b', key: 'pkg/images2/d.jpg', logicalKey: 'images2/d.jpg' },
  { bucket: 'b', key: 'pkg/other/z.webp', logicalKey: 'other/z.webp' },
]

describe('GallerySource', () => {
  it('resolves package galleries from all image files', () => {
    expect(
      resolveGalleryItems(
        {
          source: { scope: 'package' },
        },
        files,
      ).map((item) => item.path),
    ).toEqual(['images/a.jpg', 'images/nested/b.png', 'images2/d.jpg', 'other/z.webp'])
  })

  it('filters folder galleries by prefix', () => {
    expect(
      resolveGalleryItems(
        {
          source: { scope: 'folder', prefix: 'images' },
        },
        files,
      ).map((item) => item.path),
    ).toEqual(['images/a.jpg', 'images/nested/b.png'])
  })

  it('supports non-recursive folder galleries', () => {
    expect(
      resolveGalleryItems(
        {
          source: { scope: 'folder', prefix: 'images/', recursive: false },
        },
        files,
      ).map((item) => item.path),
    ).toEqual(['images/a.jpg'])
  })

  it('supports filename sort and captions', () => {
    expect(
      resolveGalleryItems(
        {
          source: { scope: 'package' },
          sort: 'filename',
          captions: 'path',
        },
        files,
      ).map((item) => item.caption),
    ).toEqual(['images/a.jpg', 'images/nested/b.png', 'images2/d.jpg', 'other/z.webp'])
  })
})
