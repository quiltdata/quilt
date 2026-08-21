import cx from 'classnames'
import * as React from 'react'
import { useHistory, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Empty from 'components/Empty'
import * as Listing from 'containers/Bucket/Listing'
import EntryView from './EntryView'
import * as DP from 'model/DataProducts'
import * as BreadCrumbs from 'components/BreadCrumbs'
import parseSearch from 'utils/parseSearch'
import { readableBytes } from 'utils/string'

/**
 * Browsing a data product's contents.
 *
 * The screen this replaces listed *that members exist* -- a table of
 * name/kind/schema/access. That is a manifest of the manifest: it tells a reader
 * a product has three members and nothing about what is in them. This shows the
 * files.
 *
 * Reuses `containers/Bucket/Listing` rather than rendering its own table, on
 * purpose. The point of the screen is that a data product feels like a package,
 * and the surest way to achieve that is to be the same component -- sorting,
 * filtering, pagination, density and row affordances all match because they are
 * literally the package browser's. What we add is the grouping
 * (`model/DataProducts/contents`), which is ours because we hold the whole
 * manifest client-side rather than getting prefixes from S3 or a resolver.
 *
 * Two couplings avoided rather than fought:
 * - `format` is called with no `urls` and no `packageHandle`, which makes `to` a
 *   raw path we then rewrite. `QuiltSummarize` set this precedent; it is what
 *   keeps the grid from needing bucket routes.
 * - `selection` is omitted entirely, which drops the checkbox column. Selection
 *   keys on `s3://` URLs and round-trips through `parseS3Url`, so it cannot
 *   represent a broker-mediated object at all.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    // Border, not shadow: a resting surface is delineated (Overlay-Only Rule).
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
  },
  head: {
    alignItems: 'baseline',
    borderBottom: `1px solid ${t.palette.divider}`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: t.spacing(1),
    justifyContent: 'space-between',
    padding: t.spacing(1.5, 2),
  },
  crumbs: {
    // Breadcrumbs are a named mono site: a path read as identity, not as a
    // repeated scanning label (Mono Identity Rule).
    ...t.typography.body2,
    fontFamily: t.typography.monospace.fontFamily,
  },
  totals: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
  },
  revision: {
    ...t.typography.caption,
    color: t.palette.text.secondary,
    display: 'block',
    fontFamily: t.typography.monospace.fontFamily,
    // Long enough to be worth wrapping rather than truncating: a top hash is
    // exact data, and "exact values are never truncated without a copy escape
    // hatch".
    overflowWrap: 'anywhere',
    padding: t.spacing(1, 2),
  },
  empty: {
    padding: t.spacing(4, 2),
  },
  emptyDir: {
    padding: t.spacing(4, 2),
  },
  entry: {
    borderTop: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  // Keyboard operability for the row, which is a div rather than a button
  // because it lives inside a DataGrid cell. Focus must never be invisible
  // (DESIGN.md's Focus Ring Rule), and the counter-color on a light surface is
  // the Midnight Chassis.
  cell: {
    cursor: 'pointer',
    '&:focus-visible': {
      outline: `2px solid ${t.palette.primary.dark}`,
      outlineOffset: -2,
    },
  },
  remedy: {
    marginTop: t.spacing(1),
  },
}))

/**
 * The reason contents are missing, rendered as its own state.
 *
 * Four reasons rather than one message, and the model owns the copy
 * (`model/DataProducts/unavailable`) so it can be asserted on. What this
 * component adds is *presentation of governance*: a permission boundary is a
 * normal state in a product built on per-bucket permissions, so it is rendered
 * in secondary ink rather than as an error. There is no error-red token in the
 * palette, and reaching for one would report a working system as broken.
 */
function Unavailable({ reason }: { reason: DP.Unavailable }) {
  const classes = useStyles()
  return (
    <Empty className={classes.empty} title={reason.title}>
      <M.Typography variant="body2" color="textSecondary">
        {reason.body}
      </M.Typography>
      {reason.remedy && (
        // Names who can act, per the RehydrateDialog precedent -- "ask your
        // admin" without saying for what is a dead end.
        <M.Typography className={classes.remedy} variant="body2" color="textSecondary">
          {reason.remedy}
        </M.Typography>
      )}
    </Empty>
  )
}

interface BrowserProps {
  product: DP.DataProduct
  member: DP.Member
  /** Current directory within the member, `''` for its root. */
  path: string
  /** Navigate to another directory. */
  onNavigate: (path: string) => void
  /** Open one file, by full logical key. */
  onOpen: (logicalKey: string) => void
  /** The file currently open in this member, if any. */
  openKey?: string
}

/**
 * One member's file tree at one directory level.
 *
 * Suspends on `useContents`. The caller supplies the Suspense boundary, so this
 * component has no loading branch of its own -- one fewer never-rendered path.
 */
function Browser({ product, member, path, onNavigate, onOpen, openKey }: BrowserProps) {
  const classes = useStyles()
  const result = DP.useContents(product.id, member.logicalName)

  // Memoized because the `[]` fallback would otherwise be a fresh array every
  // render, defeating every downstream useMemo -- which would recompute the whole
  // grouping on each keystroke in the grid's filter box.
  const entries = React.useMemo(() => (result.ok ? result.entries : []), [result])
  const grouped = React.useMemo(() => DP.groupForPath(entries, path), [entries, path])
  // Two scopes, kept distinct because they answer different questions and the
  // header shows both. `all` is the package; `here` is everything at or below the
  // directory the breadcrumb currently names.
  //
  // Conflating them was a real defect: package totals rendered beside a
  // per-directory breadcrumb, so a folder holding ten files could read
  // "1,000,000 files". Labelling each scope is what makes the number checkable
  // against what the reader can see.
  const all = React.useMemo(() => DP.totals(entries), [entries])
  const here = React.useMemo(() => DP.totalsForPath(entries, path), [entries, path])

  // `format` does the `..` row, prefix-stripping and dir/file de-duplication.
  // Passing no `urls` leaves `to` as the raw key, which the cell component below
  // turns into a navigation callback rather than a link -- the directory is not
  // in the URL path (see the note in `ContentsTab`).
  const items = React.useMemo(
    () =>
      Listing.format(
        [
          ...grouped.dirs.map((d) =>
            Listing.Entry.Dir({ key: d.prefix, size: d.sizeBytes }),
          ),
          ...grouped.files.map((f) =>
            Listing.Entry.File({ key: f.logicalKey, size: f.sizeBytes }),
          ),
        ],
        { bucket: '', prefix: DP.normalizePath(path) },
      ),
    [grouped, path],
  )

  const crumbs = BreadCrumbs.use(
    DP.normalizePath(path),
    // The segment's own prefix, carried through so `getLinkProps` below can turn
    // it into a callback. It is not a URL and never reaches an href.
    //
    // This used to return `''`, which looked harmless and was not: `Segment`
    // branches on `to != null`, and `''` is not null, so every parent crumb
    // rendered as a styled `<a>` with no href and no onClick -- a dead link, not
    // keyboard-reachable, and the only other way up a deep tree is the `..` row.
    // Exactly the WCAG 2.1.1 failure fixed for the grid rows, missed here.
    (segPath: string) => segPath,
    member.logicalName,
    // `skipRoot` is deliberately not passed: it is declared on the options type
    // but neither `getCrumbs` nor `useCrumbs` reads it, so setting it would look
    // like configuration while doing nothing. `tailLink: false` is real -- it
    // keeps the current directory from rendering as an action to itself.
    { tailLink: false },
  )

  // Turns each crumb's carried prefix into a real action. `StyledLink` renders a
  // `<button>` when given `onClick` and no `to` (see its own comment on why an
  // anchor without href is not focusable), so this gets native keyboard
  // behaviour rather than hand-rolled key handling.
  const crumbLinkProps = React.useCallback(
    ({ to }: { to?: string }) => ({ onClick: () => onNavigate(to ?? '') }),
    [onNavigate],
  )

  const CellComponent = React.useCallback(
    ({ item, className, children, ...props }: Listing.CellProps) => {
      // Both kinds act now. Files used to be inert here, on the belief that a
      // preview needed an S3 handle -- true of every *loader*, but the renderers
      // (`components/Markdown`, `JsonDisplay`, `Perspective`) take strings and
      // import no AWS anything, so `EntryView` reaches them without one.
      const act = item.type === 'dir' ? () => onNavigate(item.to) : () => onOpen(item.to)
      // `..` gets no interactivity of its own: `format` gives it a `to` that
      // points at the parent, but Listing already renders it as its own affordance
      // and a second click target on the same row is a keyboard trap in miniature.
      const inert = item.name === '..'
      return (
        <div
          className={cx(className, !inert && classes.cell)}
          {...props}
          // A div rather than a button because it sits inside a DataGrid cell, so
          // the button semantics have to be added by hand. Omitting them was a
          // real WCAG 2.1.1 failure: the row was mouse-only, and a keyboard user
          // could not open a file at all.
          role={inert ? undefined : 'button'}
          tabIndex={inert ? undefined : 0}
          onClick={inert ? undefined : act}
          onKeyDown={
            inert
              ? undefined
              : (e) => {
                  // Enter and Space are both expected of a button. Space must
                  // preventDefault or the page scrolls under the reader.
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    act()
                  }
                }
          }
        >
          {children}
        </div>
      )
    },
    [classes.cell, onNavigate, onOpen],
  )

  if (!result.ok) {
    return <Unavailable reason={DP.UNAVAILABLE[result.reason]} />
  }

  if (!entries.length) {
    // Resolvable and genuinely empty -- distinct from every reason above, and the
    // model already has the words for it.
    return <Unavailable reason={DP.UNAVAILABLE.EMPTY} />
  }

  // A directory with nothing in it is its own state, and it is reachable: a
  // bookmarked or hand-edited `dir` can name a prefix this pinned revision does
  // not contain. Checking only `entries.length` above left that case rendering an
  // empty grid beside nonzero package totals -- which reads as a broken listing
  // rather than as a path that is not here.
  //
  // Not an `Unavailable` reason: those four are about a *member* being
  // unlistable, and this member listed fine. Conflating them would tell a reader
  // to ask an admin about a stale URL.
  const emptyHere = !grouped.dirs.length && !grouped.files.length

  // Recursive over the same prefix as `here`, and that pairing is the fix. These
  // were mismatched: files counted recursively while refusals counted only direct
  // children, so a directory whose three nested objects were all refused read
  // "4 files" with no refusal notice. A UI premised on not misreporting access
  // cannot have its access count disagree with the file count beside it.
  //
  // A plain expression rather than a useMemo -- it sits after the early returns
  // above, and a hook there would change hook order between renders.
  const refused = DP.refusedForPath(entries, path)

  // Resolved against the *current directory*, not the whole member, so the open
  // file always belongs to the listing above it.
  //
  // The comment here used to claim "against the listing" while the code searched
  // `entries`. A stale link like `?dir=raw/plate_2/&file=raw/plate_10/A01.tiff`
  // therefore rendered plate_2's listing with a plate_10 file open beneath it, and
  // a reader would reasonably attribute the file to the directory shown above it.
  const openEntry = openKey
    ? grouped.files.find((e) => e.logicalKey === openKey)
    : undefined

  return (
    <div className={classes.root}>
      <div className={classes.head}>
        <div className={classes.crumbs}>
          {BreadCrumbs.render(crumbs, { getLinkProps: crumbLinkProps })}
        </div>
        <div className={classes.totals}>
          {/* Real counts only, and each one labelled with its scope. A withheld
              byte total renders as absent rather than as an em-dash or a zero:
              a partial sum shown as a total reads authoritative while
              understating.

              At the package root the two scopes are identical, so showing both
              would be noise -- `here` alone is correct and unambiguous there. */}
          {here.fileCount} {here.fileCount === 1 ? 'file' : 'files'}
          {here.sizeBytes !== undefined && ` · ${readableBytes(here.sizeBytes)}`}
          {!!DP.normalizePath(path) &&
            ` · ${all.fileCount} in package${
              all.sizeBytes !== undefined ? `, ${readableBytes(all.sizeBytes)}` : ''
            }`}
          {/* Stated rather than shown by dimming a row: state is never signalled
              by color alone. */}
          {refused > 0 && ` · ${refused} not readable by you`}
          {/* An object that exists and cannot be opened gets a line rather than
              silence. A manifest may legally hold both `raw` (a file) and
              `raw/a.txt`; only one row can carry the name, so the file is
              unreachable here -- but it is in the package, and a reader comparing
              this listing against the manifest deserves to know why it is absent
              rather than concluding the listing is wrong. */}
          {grouped.shadowed.length > 0 &&
            ` · ${grouped.shadowed.length} hidden by a same-named folder`}
        </div>
      </div>

      {emptyHere ? (
        <M.Typography className={classes.emptyDir} variant="body2" color="textSecondary">
          Nothing at this path in this revision. A pinned revision may not contain a
          directory that a later one does.
        </M.Typography>
      ) : (
        <Listing.Listing
          items={items}
          CellComponent={CellComponent}
          RootComponent="div"
          onReload={() => {}}
          // Two corrections in one predicate, both of which hid sizes we knew.
          //
          // `!== undefined` rather than truthiness: a 0-byte file has a *known*
          // size of zero, and `!f.sizeBytes` treated it as unreported.
          //
          // And dirs count too. Checking only `files` hid the column on every
          // intermediate directory of a nested package -- `raw/` holding only
          // subdirectories has no files at all, while its dir rows carry real
          // summed sizes.
          hideSize={
            !grouped.files.some((f) => f.sizeBytes !== undefined) &&
            !grouped.dirs.some((d) => d.sizeBytes !== undefined)
          }
        />
      )}

      {member.packageHandle && (
        // The revision this listing came from. Shown because it is what makes the
        // listing reproducible: the same hash yields the same files, and without
        // it a reader cannot tell whether they are looking at a fixed view or a
        // moving one.
        <M.Typography className={classes.revision} component="div">
          {member.packageHandle.name}@{member.packageHandle.topHash}
        </M.Typography>
      )}

      {openEntry && (
        // Below the listing rather than replacing it, so the surrounding files
        // stay visible -- opening one file in a plate of 300 should not cost the
        // reader their place. Its own Suspense boundary because fetching bytes is
        // a separate broker call from listing, and a spinner over the whole tree
        // would imply the listing was reloading too.
        <div className={classes.entry}>
          <React.Suspense fallback={<M.CircularProgress size={24} />}>
            <EntryView product={product} member={member} entry={openEntry} />
          </React.Suspense>
        </div>
      )}
    </div>
  )
}

/**
 * The Contents tab: one browser per member.
 *
 * Members are kept separate rather than merged into one tree, because
 * `contentsSource` carries different governance guarantees per member and a
 * single flat listing would erase that -- the type docs say so explicitly, and it
 * is the reason the previous screen grouped its tables the way it did.
 *
 * The current directory and open file live in query params rather than the path.
 * A member's logical name contains slashes (`alpha/home`), so
 * `/contents/alpha/home/raw/` cannot be split back into member and path without
 * guessing. Query params are unambiguous, and both stay linkable -- which is the
 * property the tab routes were chosen for in the first place. A reader can send
 * someone a URL that opens one file of one member at one revision.
 */
export default function ContentsTab({ product }: { product: DP.DataProduct }) {
  const location = useLocation()
  const history = useHistory()
  const { dir, file, member: activeMember } = parseSearch(location.search, true)

  // `push` for both, so browser Back walks the reader out of a file and back up a
  // directory. Replacing history would make Back leave the tab entirely, which is
  // not what "I opened this by accident" wants.
  const go = React.useCallback(
    (member: string, path: string, openKey?: string) => {
      const params = new URLSearchParams()
      params.set('member', member)
      if (path) params.set('dir', path)
      if (openKey) params.set('file', openKey)
      history.push(`${location.pathname}?${params}`)
    },
    [history, location.pathname],
  )

  if (!product.members.length) {
    // Discovery without contents. Not an empty product, and the distinction is
    // load-bearing: Unity's BROWSE grants exactly this, and a reader told "no
    // files" would conclude the product is worthless rather than that they need
    // access.
    return <Unavailable reason={DP.UNAVAILABLE.NOT_A_MEMBER} />
  }

  return (
    <>
      {product.members.map((member) => (
        <MemberSection
          key={member.logicalName}
          product={product}
          member={member}
          path={activeMember === member.logicalName ? (dir ?? '') : ''}
          openKey={activeMember === member.logicalName ? file : undefined}
          onNavigate={(path) => go(member.logicalName, path)}
          onOpen={(logicalKey) =>
            // The directory is preserved deliberately: opening a file must not
            // also navigate the tree, or closing the file would land the reader
            // somewhere they never were.
            go(
              member.logicalName,
              activeMember === member.logicalName ? (dir ?? '') : '',
              logicalKey,
            )
          }
        />
      ))}
    </>
  )
}

const useSectionStyles = M.makeStyles((t) => ({
  root: {
    '& + &': {
      marginTop: t.spacing(3),
    },
  },
  head: {
    marginBottom: t.spacing(1),
  },
  provenance: {
    marginBottom: t.spacing(1),
  },
}))

/**
 * One member, captioned with where its contents come from.
 *
 * The caption is not decoration. `CATALOG` contents are governed by the catalog
 * and may be silently row/column-filtered; `PACKAGE` contents come from a pinned
 * manifest; `DIRECT_S3` means Quilt listed the bucket itself and the catalog's
 * rules do not cover what is shown. Flattening these would imply one uniform
 * guarantee that does not exist.
 */
function MemberSection(props: BrowserProps) {
  const { product, member } = props
  const classes = useSectionStyles()
  const provenance = provenanceFor(
    member.contentsSource,
    PLATFORM_LABEL[product.binding.kind],
  )

  return (
    <section className={classes.root}>
      <M.Typography className={classes.head} variant="subtitle2">
        {member.logicalName}
      </M.Typography>
      {provenance && (
        <M.Typography
          className={classes.provenance}
          variant="body2"
          color="textSecondary"
        >
          {provenance}
        </M.Typography>
      )}
      <React.Suspense fallback={<M.CircularProgress size={24} />}>
        <Browser {...props} />
      </React.Suspense>
    </section>
  )
}

const PLATFORM_LABEL: Record<DP.PlatformKind, string> = {
  datazone: 'AWS DataZone',
  'unity-schema': 'Databricks Unity',
  'unity-share': 'Databricks Unity',
  'snowflake-listing': 'Snowflake',
}

/**
 * What a reader needs to know about where a listing came from.
 *
 * Takes the platform label rather than saying "the catalog", because which
 * catalog governs the data is exactly what a reader needs in order to act on it
 * -- "ask AWS DataZone" and "ask Databricks" send them to different systems and
 * usually different people. Naming it is also the more exact option, which
 * DESIGN.md prefers over the generic phrasing.
 *
 * `UNAVAILABLE` has no line: the `Unavailable` state says everything, and a
 * provenance note above it would answer a question the reader cannot yet ask.
 */
function provenanceFor(source: DP.ContentsSource, platform: string): string | null {
  switch (source) {
    case 'CATALOG':
      return `Enumerated and governed by ${platform}. Row and column rules may apply to what you see.`
    case 'PACKAGE':
      // The reproducibility claim, and the one thing that distinguishes this from
      // a bucket listing: a pinned manifest yields the same files every time.
      return 'Enumerated from a Quilt package manifest, pinned to one revision — the same files every time.'
    case 'DIRECT_S3':
      // The honest disclosure. The catalog gave us a bucket ARN and nothing else,
      // so Quilt lists S3 itself and the catalog's governance does not cover what
      // is shown. A reader deserves the difference between "the catalog vetted
      // this" and "we listed the bucket".
      return `${platform} identifies these by location only, so Quilt lists them from S3 directly. The catalog’s row and column rules do not apply to this listing.`
    case 'UNAVAILABLE':
      return null
  }
}
