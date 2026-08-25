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
  /**
   * Logical keys of files hidden because a sibling directory has the same name.
   *
   * A manifest can legally contain both `raw` (a file) and `raw/a.txt`. Only one
   * row can carry the name `raw`, so the file is unreachable through the grid --
   * and it used to vanish with nothing said, while the header still counted it.
   * Reported rather than dropped silently: an object that exists and cannot be
   * opened is worth one line of explanation.
   */
  shadowed: string[]
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
/**
 * One collator, hoisted.
 *
 * `String.prototype.localeCompare` with an options object constructs a fresh
 * `Intl.Collator` on *every comparison*. Measured on a 100k-entry manifest: 229ms
 * of sort time becomes 16ms with the collator cached -- a 14x difference from
 * moving one expression out of a loop. At 1M entries it is the difference between
 * a 2.2-second main-thread block on every directory change and a manageable one.
 */
const COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
})

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

  const dirNames = new Set(dirs.keys())

  return {
    dirs: Array.from(dirs, ([name, acc]) => ({
      prefix: `${prefix}${name}/`,
      fileCount: acc.fileCount,
      sizeBytes: acc.allSized ? acc.sizeBytes : undefined,
    })).sort((a, b) => COLLATOR.compare(a.prefix, b.prefix)),
    // A file whose name collides with a sibling directory is dropped here rather
    // than downstream. It has to go somewhere: `Listing.format` ends in
    // `uniqBy(prop('name'))` and emits dirs first, so the file row disappears
    // regardless -- but silently, while the header still counted it. Dropping it
    // *here* keeps the count and the grid in agreement, which is the property that
    // matters. `shadowed` reports what was lost so the UI can say so rather than
    // leaving an object in the manifest invisible and unmentioned.
    files: files
      .filter((f) => !dirNames.has(f.logicalKey.slice(prefix.length)))
      .sort((a, b) => COLLATOR.compare(a.logicalKey, b.logicalKey)),
    shadowed: files
      .filter((f) => dirNames.has(f.logicalKey.slice(prefix.length)))
      .map((f) => f.logicalKey),
  }
}

/**
 * Files at or below `path` that the current user may not read.
 *
 * Recursive, matching `totalsForPath` -- and that pairing is the point. The two
 * were mismatched: the header counted files recursively while refusals counted
 * only direct children, so a directory whose three nested objects were all
 * refused reported "4 files" with no refusal notice at all. A UI whose premise is
 * not misreporting access cannot have its access count disagree with the file
 * count sitting beside it.
 */
export function refusedForPath(entries: ContentEntry[], path: string = ''): number {
  const prefix = normalizePath(path)
  let refused = 0
  for (const entry of entries) {
    if (prefix && !entry.logicalKey.startsWith(prefix)) continue
    // Same dir-marker predicate as both total functions, so all three agree on
    // what counts as a file.
    if (isDirMarker(entry.logicalKey)) continue
    if (entry.readable === false) refused += 1
  }
  return refused
}

export interface Totals {
  fileCount: number
  sizeBytes?: number
}

/**
 * A key that names a directory rather than an object in one.
 *
 * Some writers emit an explicit `raw/` marker. It is not a file, and counting it
 * as one made the two total functions disagree about the same manifest: at the
 * root `totals` counted the marker, while inside `raw/` it was skipped, so the
 * same package reported 2 files from one directory and 1 from another. One
 * predicate, used by both.
 */
const isDirMarker = (logicalKey: string) => logicalKey.endsWith('/')

/**
 * Total files and bytes for a whole package.
 *
 * `sizeBytes` is `undefined` unless every entry reported one, for the same
 * reason as folder totals.
 */
export function totals(entries: ContentEntry[]): Totals {
  let fileCount = 0
  let sizeBytes = 0
  let allSized = true
  for (const entry of entries) {
    if (isDirMarker(entry.logicalKey)) continue
    fileCount += 1
    if (typeof entry.sizeBytes === 'number') sizeBytes += entry.sizeBytes
    else allSized = false
  }
  return { fileCount, sizeBytes: allSized ? sizeBytes : undefined }
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
    // Same predicate `totals` uses, so the two cannot disagree about whether a
    // `raw/` marker is a file. That disagreement was a real bug: the root said 2
    // files, `raw/` said 1, for one manifest.
    if (isDirMarker(entry.logicalKey)) continue
    fileCount += 1
    if (typeof entry.sizeBytes === 'number') sizeBytes += entry.sizeBytes
    else allSized = false
  }
  return { fileCount, sizeBytes: allSized ? sizeBytes : undefined }
}
