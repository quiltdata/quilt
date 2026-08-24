import { describe, expect, it } from 'vitest'

import {
  groupForPath,
  normalizePath,
  refusedForPath,
  totals,
  totalsForPath,
} from './contents'
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
      expect(groupForPath(ENTRIES, 'nope/')).toEqual({
        dirs: [],
        files: [],
        shadowed: [],
      })
    })

    it('drops a file shadowed by a same-named folder, and says which', () => {
      // A manifest can legally hold both `raw` (a file) and `raw/a.txt`. Only one
      // row can carry the name, and `Listing.format` ends in
      // `uniqBy(prop('name'))` with dirs first -- so the file used to vanish
      // downstream, silently, while the header still counted it.
      //
      // Dropped here instead, so the count and the grid agree, and reported so the
      // UI can mention an object that exists and cannot be opened.
      const { dirs, files, shadowed } = groupForPath([
        { logicalKey: 'raw', sizeBytes: 500 },
        { logicalKey: 'raw/a.txt', sizeBytes: 10 },
      ])
      expect(dirs.map((d) => d.prefix)).toEqual(['raw/'])
      expect(files).toEqual([])
      expect(shadowed).toEqual(['raw'])
    })

    it('treats a directory marker as a directory, not a file', () => {
      // An explicit `raw/` key is not an object in `raw/`. Counting it as one made
      // the two total functions disagree about one manifest: the root said 2 files,
      // `raw/` said 1.
      const e = [{ logicalKey: 'raw/' }, { logicalKey: 'raw/a.txt', sizeBytes: 1 }]
      expect(totals(e).fileCount).toBe(1)
      expect(totalsForPath(e, 'raw/').fileCount).toBe(1)
    })

    it('excludes a nested directory marker from the folder row it sits in', () => {
      // The folder row and the header read the same manifest, so counting the
      // marker made them disagree -- and because a marker carries no size, it also
      // cleared `allSized` and blanked a total the folder fully knew.
      const e = [
        { logicalKey: 'raw/sub/' },
        { logicalKey: 'raw/sub/a.txt', sizeBytes: 10 },
        { logicalKey: 'raw/sub/b.txt', sizeBytes: 20 },
      ]
      const { dirs } = groupForPath(e, 'raw/')
      expect(dirs[0]).toMatchObject({ fileCount: 2, sizeBytes: 30 })
      expect(totalsForPath(e, 'raw/')).toEqual({ fileCount: 2, sizeBytes: 30 })
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

  describe('totalsForPath', () => {
    it('counts everything at or below a directory, not just direct children', () => {
      // Recursive on purpose, so the header agrees with the folder rows --
      // DirGroup.fileCount is already recursive, and a header that counted only
      // direct children would contradict the row beneath it.
      expect(totalsForPath(ENTRIES, 'raw/')).toEqual({ fileCount: 3, sizeBytes: 600 })
      expect(totalsForPath(ENTRIES, 'raw/plate_10/')).toEqual({
        fileCount: 2,
        sizeBytes: 500,
      })
    })

    it('is the whole package at the root, so it generalizes totals', () => {
      expect(totalsForPath(ENTRIES, '')).toEqual(totals(ENTRIES))
      expect(totalsForPath(ENTRIES, '/')).toEqual(totals(ENTRIES))
    })

    it('reports zero for a path this revision does not contain', () => {
      // Not an error: a pinned revision may genuinely lack a directory a later one
      // has. The UI renders this as "nothing at this path".
      expect(totalsForPath(ENTRIES, 'nope/')).toEqual({ fileCount: 0, sizeBytes: 0 })
    })

    it('withholds the byte total when an entry below the path lacks a size', () => {
      const t = totalsForPath(
        [{ logicalKey: 'raw/a.tiff', sizeBytes: 100 }, { logicalKey: 'raw/b.tiff' }],
        'raw/',
      )
      expect(t.fileCount).toBe(2)
      expect(t.sizeBytes).toBeUndefined()
    })

    it('does not count the folder key itself as a file in it', () => {
      const t = totalsForPath(
        [{ logicalKey: 'raw/' }, { logicalKey: 'raw/a.tiff', sizeBytes: 1 }],
        'raw/',
      )
      expect(t.fileCount).toBe(1)
    })
  })

  describe('refusedForPath', () => {
    it('counts refusals recursively, matching how files are counted', () => {
      // The mismatch this fixes: files counted recursively while refusals counted
      // only direct children, so a directory whose three nested objects were all
      // refused read "4 files" with no refusal notice at all.
      const e = [
        { logicalKey: 'raw/plate_1/a.tiff', readable: false },
        { logicalKey: 'raw/plate_1/b.tiff', readable: false },
        { logicalKey: 'raw/plate_1/c.tiff', readable: false },
        { logicalKey: 'raw/top.txt', readable: true },
      ]
      expect(totalsForPath(e, 'raw/').fileCount).toBe(4)
      expect(refusedForPath(e, 'raw/')).toBe(3)
    })

    it('scopes to the directory on screen', () => {
      const e = [
        { logicalKey: 'a/secret.txt', readable: false },
        { logicalKey: 'b/open.txt', readable: true },
      ]
      expect(refusedForPath(e, 'b/')).toBe(0)
      expect(refusedForPath(e, 'a/')).toBe(1)
      expect(refusedForPath(e, '')).toBe(1)
    })

    it('treats an absent readable flag as readable, not refused', () => {
      // `readable` is optional; absent means the adapter said nothing. Counting
      // silence as a refusal would invent a denial.
      expect(refusedForPath([{ logicalKey: 'a.txt' }], '')).toBe(0)
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
