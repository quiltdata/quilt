/**
 * Grouping a flat list of package entries into one directory level.
 *
 * A Quilt package manifest is flat: every entry is a full logical key like
 * `raw/plate_01/A01.tiff`. Browsing it means grouping by prefix, one level at a
 * time. This module does only that -- no fetching, no React -- so the rules are
 * testable in isolation.
 *
 * **Scope is deliberately narrow.** It stops at grouping and hands off to
 * `containers/Bucket/Listing`'s `Entry` + `format`, which already do the
 * `..` row, display-name stripping, and dir/file name de-duplication. Redoing
 * those here would be a second implementation of behaviour the package browser
 * already has, and the point of this screen is to feel like that browser.
 *
 * Why the grouping itself is ours rather than borrowed: the bucket browser gets
 * grouping from S3's `CommonPrefixes` (a server-side computation over a live
 * bucket) and the package browser gets it from a GraphQL resolver that returns
 * pre-grouped children. Neither applies -- we hold the whole flat manifest
 * client-side, pinned to an immutable revision, so grouping is a local
 * computation. Doing it here keeps that reproducibility visible
 * (`wb/dp-ui-slice-1/research/raja-poc-reverse-engineered.md` §4).
 */

/** One entry as a manifest reports it. */
export interface ContentEntry {
  /** Full logical key within the package, e.g. `raw/plate_01/A01.tiff`. */
  logicalKey: string
  sizeBytes?: number
  /**
   * Whether the current user may read this object's bytes.
   *
   * Per-entry rather than per-package because the broker decides per object: it
   * checks manifest membership on each request, so a listing can be fully
   * visible while an individual object is refused (research §3.1).
   */
  readable?: boolean
  /**
   * Pinned Quilt+ URI for this one entry, including its `path` fragment.
   *
   * Not invented for the UI: the working implementation's contents endpoint
   * already emits `{path, size, usl}` per entry, where `usl` is exactly this
   * (`research/raja-poc-reverse-engineered.md` §4). Carried through because it is
   * the entry's *identity* -- the thing to show a reader, copy to a clipboard,
   * and hand to a broker in exchange for bytes.
   *
   * Optional because a catalog-enumerated member has no package URI at all. Its
   * absence is what distinguishes an entry we can address from one we can only
   * name.
   */
  usl?: string
}

/** A folder at the current level. */
export interface DirGroup {
  /** Full prefix including trailing slash. */
  prefix: string
  /** Files at or below this folder. */
  fileCount: number
  /**
   * Summed size of files below, when *every* one reported a size.
   *
   * `undefined` when any did not. A partial sum rendered as a total reads as
   * authoritative while understating the folder, and a number has nowhere to
   * carry "partial".
   */
  sizeBytes?: number
}

export interface Grouped {
  dirs: DirGroup[]
  files: ContentEntry[]
}

/**
 * Normalize a directory path to `''` or `'a/b/'`.
 *
 * Tolerant of the sloppy forms a URL or caller may produce (`/a/b`, `a//b/`),
 * because a path arriving from a route param is not under our control and a
 * leading slash matching nothing looks exactly like an empty folder.
 */
export function normalizePath(path: string): string {
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!trimmed) return ''
  return `${trimmed.split('/').filter(Boolean).join('/')}/`
}

/**
 * Group entries into the folders and files visible at one level.
 *
 * Sorted here rather than left to the grid: dirs before files, each by
 * locale-aware numeric comparison so `plate_2` precedes `plate_10`. That is what
 * someone reading plate names means, even though bytewise ordering disagrees.
 * The grid can re-sort on user request; this is the order it starts in.
 *
 * Entries outside `path` are skipped rather than treated as an error. Navigating
 * to a prefix absent from this revision yields an empty level, which the UI
 * renders as such -- a pinned revision genuinely may not contain a path that a
 * later one does.
 */
export function groupForPath(entries: ContentEntry[], path: string = ''): Grouped {
  const prefix = normalizePath(path)

  const files: ContentEntry[] = []
  const dirs = new Map<
    string,
    { fileCount: number; sizeBytes: number; allSized: boolean }
  >()

  for (const entry of entries) {
    if (prefix && !entry.logicalKey.startsWith(prefix)) continue
    const rest = entry.logicalKey.slice(prefix.length)
    // A key equal to the prefix is the folder itself, not a file in it.
    if (!rest) continue

    const slash = rest.indexOf('/')
    if (slash === -1) {
      files.push(entry)
      continue
    }

    const name = rest.slice(0, slash)
    // Guards `a//b`, which would otherwise produce a nameless folder row.
    if (!name) continue
    const acc = dirs.get(name) ?? { fileCount: 0, sizeBytes: 0, allSized: true }
    acc.fileCount += 1
    if (typeof entry.sizeBytes === 'number') acc.sizeBytes += entry.sizeBytes
    else acc.allSized = false
    dirs.set(name, acc)
  }

  const collator = (a: string, b: string) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })

  return {
    dirs: Array.from(dirs, ([name, acc]) => ({
      prefix: `${prefix}${name}/`,
      fileCount: acc.fileCount,
      sizeBytes: acc.allSized ? acc.sizeBytes : undefined,
    })).sort((a, b) => collator(a.prefix, b.prefix)),
    files: files.sort((a, b) => collator(a.logicalKey, b.logicalKey)),
  }
}

export interface Totals {
  fileCount: number
  sizeBytes?: number
}

/**
 * Total files and bytes for a whole package.
 *
 * `sizeBytes` is `undefined` unless every entry reported one, for the same
 * reason as folder totals.
 */
export function totals(entries: ContentEntry[]): Totals {
  let sizeBytes = 0
  let allSized = true
  for (const entry of entries) {
    if (typeof entry.sizeBytes === 'number') sizeBytes += entry.sizeBytes
    else allSized = false
  }
  return { fileCount: entries.length, sizeBytes: allSized ? sizeBytes : undefined }
}

/**
 * Totals for everything at or below one directory.
 *
 * Exists because the two scopes were conflated in the UI: package-wide totals
 * were rendered beside a per-directory breadcrumb, so a folder holding ten files
 * could read "1,000,000 files". Caught by cross-model review.
 *
 * Counts *at or below* rather than only the direct children, so the header agrees
 * with the folder rows beneath it -- `DirGroup.fileCount` is already recursive,
 * and a header counting only direct children would contradict the row under it.
 *
 * `path` of `''` is the whole package, which makes this a strict generalization
 * of `totals`.
 */
export function totalsForPath(entries: ContentEntry[], path: string = ''): Totals {
  const prefix = normalizePath(path)
  if (!prefix) return totals(entries)

  let fileCount = 0
  let sizeBytes = 0
  let allSized = true
  for (const entry of entries) {
    if (!entry.logicalKey.startsWith(prefix)) continue
    // A key equal to the prefix is the folder itself, not a file in it.
    if (entry.logicalKey.length === prefix.length) continue
    fileCount += 1
    if (typeof entry.sizeBytes === 'number') sizeBytes += entry.sizeBytes
    else allSized = false
  }
  return { fileCount, sizeBytes: allSized ? sizeBytes : undefined }
}
