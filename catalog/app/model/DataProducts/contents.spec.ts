import { describe, expect, it } from 'vitest'

import { groupForPath, normalizePath, totals } from './contents'
import type { ContentEntry } from './contents'

/**
 * A manifest shaped like a real one: nested dirs, a root-level file, and a
 * numeric-suffix series that sorts differently bytewise than a reader expects.
 */
const ENTRIES: ContentEntry[] = [
  { logicalKey: 'README.md', sizeBytes: 147 },
  { logicalKey: 'raw/plate_2/A01.tiff', sizeBytes: 100 },
  { logicalKey: 'raw/plate_10/A01.tiff', sizeBytes: 200 },
  { logicalKey: 'raw/plate_10/A02.tiff', sizeBytes: 300 },
  { logicalKey: 'derived/counts.csv', sizeBytes: 50 },
]

describe('model/DataProducts/contents', () => {
  describe('normalizePath', () => {
    it('normalizes the sloppy forms a route param can produce', () => {
      // Each of these is a real shape a URL or caller hands over. A leading
      // slash surviving into a startsWith() match means the prefix matches
      // nothing, which renders as an empty folder rather than as a bug.
      expect(normalizePath('')).toBe('')
      expect(normalizePath('/')).toBe('')
      expect(normalizePath('raw')).toBe('raw/')
      expect(normalizePath('/raw/')).toBe('raw/')
      expect(normalizePath('raw//plate_10')).toBe('raw/plate_10/')
    })
  })

  describe('groupForPath', () => {
    it('splits one level into folders and files', () => {
      const { dirs, files } = groupForPath(ENTRIES)
      expect(dirs.map((d) => d.prefix)).toEqual(['derived/', 'raw/'])
      expect(files.map((f) => f.logicalKey)).toEqual(['README.md'])
    })

    it('descends into a prefix', () => {
      const { dirs, files } = groupForPath(ENTRIES, 'raw/')
      expect(dirs.map((d) => d.prefix)).toEqual(['raw/plate_2/', 'raw/plate_10/'])
      expect(files).toEqual([])
    })

    it('sorts numeric segments the way a reader reads them', () => {
      // plate_2 before plate_10. Bytewise ordering disagrees ('1' < '2'), and
      // bytewise is what you get for free -- so this is the assertion that
      // fails if the collator options are dropped.
      const { dirs } = groupForPath(ENTRIES, 'raw/')
      expect(dirs.map((d) => d.prefix)).toEqual(['raw/plate_2/', 'raw/plate_10/'])
    })

    it('counts and sums what is below a folder, not just its direct children', () => {
      const { dirs } = groupForPath(ENTRIES)
      const raw = dirs.find((d) => d.prefix === 'raw/')
      // 3 files two levels down, 100 + 200 + 300.
      expect(raw).toMatchObject({ fileCount: 3, sizeBytes: 600 })
    })

    it('reports no folder total when any file below it lacks a size', () => {
      // The load-bearing case. A partial sum rendered as a total reads as
      // authoritative while understating the folder, and "trust is rendered,
      // not asserted" makes that a defect rather than a rounding choice.
      const { dirs } = groupForPath([
        { logicalKey: 'raw/a.tiff', sizeBytes: 100 },
        { logicalKey: 'raw/b.tiff' },
      ])
      expect(dirs[0]).toMatchObject({ fileCount: 2 })
      expect(dirs[0]!.sizeBytes).toBeUndefined()
    })

    it('returns an empty level for a prefix absent from this revision', () => {
      // Not an error: a pinned revision may genuinely not contain a path that a
      // later one does, and the UI renders that as an empty folder.
      expect(groupForPath(ENTRIES, 'nope/')).toEqual({ dirs: [], files: [] })
    })

    it('ignores a key equal to the prefix rather than showing a nameless row', () => {
      const { dirs, files } = groupForPath(
        [{ logicalKey: 'raw/', sizeBytes: 0 }, { logicalKey: 'raw/a.tiff' }],
        'raw/',
      )
      expect(dirs).toEqual([])
      expect(files.map((f) => f.logicalKey)).toEqual(['raw/a.tiff'])
    })

    it('does not invent a nameless folder from a doubled slash', () => {
      const { dirs } = groupForPath([{ logicalKey: 'raw//a.tiff' }], 'raw/')
      expect(dirs).toEqual([])
    })

    it('carries per-entry readability through to the file row', () => {
      // The broker decides per object, so a listing can be visible while one
      // object in it is refused. Dropping this field would make that
      // unrenderable.
      const { files } = groupForPath([{ logicalKey: 'a.tiff', readable: false }])
      expect(files[0]!.readable).toBe(false)
    })
  })

  describe('totals', () => {
    it('sums the whole package', () => {
      expect(totals(ENTRIES)).toEqual({ fileCount: 5, sizeBytes: 797 })
    })

    it('withholds the byte total when any entry lacks a size', () => {
      const t = totals([{ logicalKey: 'a' }, { logicalKey: 'b', sizeBytes: 1 }])
      expect(t.fileCount).toBe(2)
      expect(t.sizeBytes).toBeUndefined()
    })
  })
})
