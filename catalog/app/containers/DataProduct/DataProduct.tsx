import { dirname, resolve } from 'path'

import * as React from 'react'
import {
  Link,
  Redirect,
  Route,
  Switch,
  matchPath,
  useLocation,
  useParams,
} from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Icons from '@material-ui/icons'

import * as BreadCrumbs from 'components/BreadCrumbs'
import Layout, { Container } from 'components/Layout'
import Markdown from 'components/Markdown'
import * as Preview from 'components/Preview'
import SelectDropdown from 'components/SelectDropdown'
import Section from 'containers/Bucket/Section'
import * as Listing from 'containers/Bucket/Listing'
import renderPreview from 'containers/Bucket/renderPreview'
import * as requests from 'containers/Bucket/requests'
import DIR_QUERY from 'containers/Bucket/PackageTree/gql/Dir.generated'
import FILE_QUERY from 'containers/Bucket/PackageTree/gql/File.generated'
import * as SearchHits from 'containers/Search/List/Hit'
import {
  ColumnTag,
  ColumnUserMetaCreate,
  PackageRow,
} from 'containers/Search/Table/Table'
import type {
  Column,
  Hit as SearchTableHit,
  PackageLinkBuilder,
} from 'containers/Search/Table/Table'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from 'containers/Search/i18n'
import type { SearchHitPackage } from 'containers/Search/model'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Resource from 'utils/Resource'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import DP_QUERY from './gql/DataProduct.generated'
import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'
import {
  compileFilter,
  defaultVisibleMeta,
  deriveMetaColumns,
  matchMeta,
} from './packagesMeta'
import type { MetaColumnSpec } from './packagesMeta'

type DataProduct = NonNullable<DataProductQuery['dataProduct']>
type ObjectMember = DataProduct['members']['objects'][number]
type PackageMember = DataProduct['members']['packages'][number]

// The Listing rows are plain navigation links; nothing here mutates, so reload
// is a no-op.
const noop = () => {}

const pluralize = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

// The logical key a manifest must place an object at for it to render as the DP
// overview README (mirrors a bucket overview's README member file).
const README_KEY = 'README.md'

const useStyles = M.makeStyles((t) => ({
  // Spaces the header card away from the search bar above it, mirroring the
  // bucket page.
  content: {
    marginTop: t.spacing(3),
  },
  // The DP title/summary row and the tabs live in one elevated white card, the
  // DP analogue of the bucket header card.
  headerCard: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    marginBottom: t.spacing(2),
  },
  headerTop: {
    padding: t.spacing(2, 3),
  },
  overline: {
    display: 'block',
    lineHeight: 1.5,
  },
  summary: {
    marginTop: t.spacing(0.5),
  },
  tabsRow: {
    padding: t.spacing(0, 3),
  },
  crumbs: {
    ...t.typography.body1,
    marginBottom: t.spacing(2),
    wordBreak: 'break-word',
  },
  section: {
    padding: t.spacing(3),
  },
  // The physical origin of a member is provenance only — a small muted detail,
  // never a navigation link.
  provenance: {
    marginBottom: t.spacing(2),
  },
  // Overview: the authored own-content + stats card sits on top; the README
  // member preview is a visually distinct card below it.
  infoCard: {
    padding: t.spacing(3),
    marginBottom: t.spacing(2),
  },
  readmeCard: {
    padding: t.spacing(3),
  },
  stat: {
    marginTop: t.spacing(2),
  },
  // Packages chrome — replicates the in-bucket package-list idiom (filter field,
  // a count + card/table toggle + sort toolbar, then the results).
  filterField: {
    background: t.palette.background.paper,
    marginBottom: t.spacing(2),
  },
  toolbar: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    minHeight: t.spacing(4.5),
    marginBottom: t.spacing(2),
  },
  count: {
    ...t.typography.subtitle1,
    flexShrink: 0,
    marginRight: t.spacing(2),
  },
  toolbarControls: {
    alignItems: 'center',
    display: 'flex',
    flexGrow: 1,
    justifyContent: 'flex-end',
  },
  viewToggle: {
    marginRight: t.spacing(1),
  },
  columnsButton: {
    marginRight: t.spacing(1),
  },
  // Uniform spacing between the shared hit cards and the fallback cards alike
  // (both spacing idioms only cover same-class siblings on their own).
  cardList: {
    '& > * + *': {
      marginTop: t.spacing(2),
    },
  },
  // Fallback card for a member whose package didn't dereference — matches the
  // outlined-Paper look of the shared hit card.
  packageCard: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: t.spacing(2),
  },
  packageName: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
  },
  tableRoot: {
    overflowX: 'auto',
  },
  // Mirrors the shared search table's column-head typography.
  tableHeadCell: {
    ...t.typography.subtitle1,
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  // Trailing spacer column, same as the shared table's placeholder cell.
  tablePlaceholder: {
    width: t.spacing(5),
  },
  loadMore: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: t.spacing(2),
  },
  readme: {
    marginBottom: t.spacing(3),
  },
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  return <M.Tab component={Link} {...props} />
}

// The tail of the current route selects the active tab, exactly as the bucket
// page's tab tracks its route. Both the package list and a package drill-in map
// to the Packages tab.
function useSection(): string {
  const { paths } = NamedRoutes.use()
  const { pathname } = useLocation()
  if (
    matchPath(pathname, { path: paths.dataProductPackage }) ||
    matchPath(pathname, { path: paths.dataProductPackages, exact: true })
  ) {
    return 'packages'
  }
  if (matchPath(pathname, { path: paths.dataProductObjects })) {
    return 'objects'
  }
  return 'overview'
}

interface HeaderProps {
  dp: DataProduct
}

function Header({ dp }: HeaderProps) {
  const classes = useStyles()
  const summary = [
    dp.ownerRole.name,
    pluralize(dp.members.packages.length, 'package'),
    pluralize(dp.members.objects.length, 'object'),
  ].join(' · ')
  return (
    <div className={classes.headerTop}>
      <M.Typography variant="overline" color="textSecondary" className={classes.overline}>
        Data product
      </M.Typography>
      <M.Typography variant="h5">{dp.title || dp.name}</M.Typography>
      <M.Typography variant="body2" color="textSecondary" className={classes.summary}>
        {summary}
      </M.Typography>
    </div>
  )
}

interface TabsProps {
  id: string
  section: string
}

function Tabs({ id, section }: TabsProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
      <NavTab label="Overview" value="overview" to={urls.dataProduct(id)} />
      <NavTab label="Objects" value="objects" to={urls.dataProductObjects(id)} />
      <NavTab label="Packages" value="packages" to={urls.dataProductPackages(id)} />
    </M.Tabs>
  )
}

// Maps raw markdown link hrefs for content rendered under the DP route:
// relative (Resource Path) links resolve against the member's virtual
// logicalKey directory to a sibling DP-local URL; web URLs keep their default
// behavior; s3:// and bucket-absolute pointers have no DP-local meaning and
// stay as-is (inert strings) — never rewritten to a physical /b/<bucket>/
// route.
function useDPLinkProcessor(logicalKey: string, mkLink: (path: string) => string) {
  return React.useCallback(
    (href: string): string =>
      Resource.Pointer.case({
        Web: (url: string) => url,
        S3: () => href,
        S3Rel: () => href,
        Path: (p: string) => {
          if (p.startsWith('/')) return href
          const hasSlash = p.endsWith('/')
          const resolved = resolve(dirname(logicalKey), p).slice(1)
          return mkLink(hasSlash ? `${resolved}/` : resolved)
        },
      })(Resource.parse(href)),
    [logicalKey, mkLink],
  )
}

// Renders a file's bytes in place under the DP route: the physical handle
// (bucket/key/versionId) is used only to fetch bytes — the URL and UI stay
// DP-local. The bucket is warmed first so cross-bucket presigned URLs get the
// correct region.
interface FileHandle {
  bucket: string
  key: string
  version?: string
  logicalKey: string
}

interface FilePreviewProps {
  handle: FileHandle
  // maps a DP-local logical path to its URL under /data-products/:id
  mkLink: (path: string) => string
}

function FilePreview({ handle, mkLink }: FilePreviewProps) {
  const processLink = useDPLinkProcessor(handle.logicalKey, mkLink)
  return (
    <Section icon="remove_red_eye" heading="Preview" expandable={false}>
      {useBucketExistence(handle.bucket).case({
        Ok: () =>
          Preview.load(handle, renderPreview(), {
            context: Preview.CONTEXT.FILE,
            processLink,
          }),
        Err: () => (
          <M.Typography color="error">
            Could not access the object's storage.
          </M.Typography>
        ),
        _: () => <M.CircularProgress />,
      })}
    </Section>
  )
}

// The physical origin of a member, shown as a small muted detail. It is
// provenance metadata only — never a navigation target.
function Provenance({ children }: React.PropsWithChildren<{}>) {
  const classes = useStyles()
  return (
    <M.Typography
      variant="caption"
      color="textSecondary"
      component="div"
      className={classes.provenance}
    >
      Provenance: {children}
    </M.Typography>
  )
}

// Fetches + renders the README member's markdown, like a bucket overview README.
function ReadmePreview({ id, member }: { id: string; member: ObjectMember }) {
  const { urls } = NamedRoutes.use()
  const s3 = AWS.S3.use()
  const handle: Model.S3.S3ObjectLocation = React.useMemo(
    () => ({
      bucket: member.bucket,
      key: member.key,
      version: member.versionId ?? undefined,
    }),
    [member],
  )
  const mkLink = React.useCallback(
    (p: string) => urls.dataProductObjects(id, p),
    [id, urls],
  )
  // Relative links resolve to sibling object members under the DP route —
  // never to the physical bucket.
  const processLink = useDPLinkProcessor(member.logicalKey, mkLink)
  const data = useData(requests.fetchFile, { s3, handle })
  return data.case({
    Err: () => null,
    Ok: ({ body }: { body?: { toString: (enc: string) => string } }) => (
      <Markdown data={body?.toString('utf-8') ?? ''} processLink={processLink} />
    ),
    _: () => <M.CircularProgress />,
  })
}

// A labelled stat line inside the Overview info section.
function Stat({ label, children }: React.PropsWithChildren<{ label: string }>) {
  const classes = useStyles()
  return (
    <div className={classes.stat}>
      <M.Typography variant="subtitle2" gutterBottom>
        {label}
      </M.Typography>
      <M.Typography variant="body2" color="textSecondary">
        {children}
      </M.Typography>
    </div>
  )
}

// Overview: two stacked, visually distinct sections — a top info card (authored
// own-content + stats), then, only when the manifest places a `README.md`
// object member, a separate card below it previewing that member.
function OverviewTab({ dp }: { dp: DataProduct }) {
  const classes = useStyles()
  const readmeMember = dp.members.objects.find((o) => o.logicalKey === README_KEY)
  const summary = [
    pluralize(dp.members.packages.length, 'package'),
    pluralize(dp.members.objects.length, 'object'),
  ].join(' · ')
  const hasOwnContent = !!dp.title || !!dp.description
  return (
    <>
      <M.Paper className={classes.infoCard}>
        {hasOwnContent ? (
          <>
            {!!dp.title && <M.Typography variant="h6">{dp.title}</M.Typography>}
            {!!dp.description && (
              <M.Typography variant="body1">{dp.description}</M.Typography>
            )}
          </>
        ) : (
          <M.Typography color="textSecondary">
            No description for this data product
          </M.Typography>
        )}
        <Stat label="Members">{summary}</Stat>
        <Stat label="Owner">{dp.ownerRole.name}</Stat>
        <Stat label="Created">{dp.createdAt.toLocaleString()}</Stat>
      </M.Paper>
      {!!readmeMember && (
        <M.Paper className={classes.readmeCard}>
          <ReadmePreview id={dp.id} member={readmeMember} />
        </M.Paper>
      )}
    </>
  )
}

function ObjectsTab({ id, dp }: { id: string; dp: DataProduct }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { path = '' } = useParams<{ path?: string }>()

  // A leaf: the path names an object member exactly — render its file view in
  // place under the DP route.
  const fileMember = dp.members.objects.find((o) => o.logicalKey === path)

  const getSegmentRoute = React.useCallback(
    (segPath: string) =>
      urls.dataProductObjects(id, segPath ? s3paths.ensureSlash(segPath) : ''),
    [id, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, dp.name)

  // Relative markdown links inside a previewed member resolve to sibling
  // object members under the DP route.
  const mkLink = React.useCallback(
    (p: string) => urls.dataProductObjects(id, p),
    [id, urls],
  )

  // The prefix of the virtual folder currently open (always '' or slash-ended);
  // breadcrumb clicks can arrive without the trailing slash, so normalize.
  const prefix = fileMember || !path ? '' : s3paths.ensureSlash(path)

  // Synthesize the immediate children of the current virtual folder from the
  // flat object members' logical keys: a remainder with a '/' is a virtual dir
  // (deduped), otherwise a leaf file that opens in place under the DP route.
  const items = React.useMemo(() => {
    const seenDirs = new Set<string>()
    const result: Listing.Item[] = []
    dp.members.objects.forEach((o) => {
      if (!o.logicalKey.startsWith(prefix)) return
      const rest = o.logicalKey.slice(prefix.length)
      if (!rest) return
      const slash = rest.indexOf('/')
      if (slash === -1) {
        result.push({
          type: 'file',
          name: rest,
          to: urls.dataProductObjects(id, o.logicalKey),
        })
      } else {
        const seg = rest.slice(0, slash)
        if (seenDirs.has(seg)) return
        seenDirs.add(seg)
        result.push({
          type: 'dir',
          name: seg,
          to: urls.dataProductObjects(id, prefix + seg + '/'),
        })
      }
    })
    return result
  }, [dp.members.objects, id, prefix, urls])

  return (
    <>
      <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
        {BreadCrumbs.render(crumbs)}
      </div>
      {fileMember ? (
        <>
          <Provenance>
            {`s3://${fileMember.bucket}/${fileMember.key}`}
            {fileMember.versionId ? ` (version ${fileMember.versionId})` : ''}
          </Provenance>
          <FilePreview
            handle={{
              bucket: fileMember.bucket,
              key: fileMember.key,
              version: fileMember.versionId ?? undefined,
              logicalKey: fileMember.logicalKey,
            }}
            mkLink={mkLink}
          />
        </>
      ) : items.length ? (
        <Listing.Listing items={items} onReload={noop} />
      ) : (
        <M.Typography color="textSecondary">No readable objects</M.Typography>
      )}
    </>
  )
}

// The Packages tab presents the in-bucket package-list experience over the
// DP's in-hand package members (a fixed list, not a search): a filter field, a
// count + card/table toggle + sort toolbar, then the shared package-listing
// leaves (Search/List `Hit.Package` cards, Search/Table `PackageRow` rows) fed
// hit-shaped rows synthesized from the members. Metadata parity is computed
// client-side over that fixed list (see ./packagesMeta): user-meta paths are
// derived from the loaded `userMeta` payloads and surfaced as table columns
// (the leading few by coverage; the rest behind a compact Columns menu), and
// the filter field understands `key:value` meta terms alongside free-text name
// terms. Every link is re-rooted DP-local through the leaves'
// `PackageLinkBuilder` seam (urls.dataProductPackage) — never a /b/<bucket>/
// route; the search-model-bound chrome (facet drawer, server-side facets,
// matching-entries expansion) is intentionally absent, and the tab is
// read-only (no authoring affordances).

type PackageView = 'card' | 'table'

const VIEW_STORAGE_KEY = 'QUILT_DP_PACKAGES_VIEW'

// The display toggle persists across reloads, the faithful analogue of how the
// bucket package list persists its view (that one rides the URL search state; a
// DP is a fixed in-hand list, so a stored local preference plays the same role).
function useViewMode(): [PackageView, (v: PackageView | null) => void] {
  const [view, setView] = React.useState<PackageView>(() => {
    try {
      const v = localStorage.getItem(VIEW_STORAGE_KEY)
      return v === 'card' || v === 'table' ? v : 'table'
    } catch {
      return 'table'
    }
  })
  const set = React.useCallback((v: PackageView | null) => {
    // ToggleButtonGroup fires null when the active button is re-clicked; ignore
    // it so a view is always selected.
    if (!v) return
    setView(v)
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, v)
    } catch {
      // Privacy settings can make localStorage throw; the in-memory state still
      // updates, we just don't persist.
    }
  }, [])
  return [view, set]
}

type SortKey = 'name' | 'modified'
type SortDir = 'asc' | 'desc'

interface SortSpec {
  key: SortKey
  dir: SortDir
}

// Client-side sort over the fixed member list, offered through the same
// SelectDropdown the bucket list uses (and mirrored by the table headers).
const SORT_OPTIONS = [
  { toString: () => 'A → Z', valueOf: () => 'name:asc' },
  { toString: () => 'Z → A', valueOf: () => 'name:desc' },
  { toString: () => 'Most recent first', valueOf: () => 'modified:desc' },
  { toString: () => 'Least recent first', valueOf: () => 'modified:asc' },
]

const sortToValue = ({ key, dir }: SortSpec) => `${key}:${dir}`

const PER_PAGE = 30

type MemberRevision = NonNullable<NonNullable<PackageMember['package']>['revision']>

// The members query dereferences `package.revision` at the default "latest" —
// GraphQL cannot pass a per-member pin inside one list selection. That latest
// revision stands in as the member's effective revision only when the member
// is unpinned, or its pin names that same revision (a full hash, or a >= 6
// char short-hash prefix); otherwise the stats in hand describe a different
// revision and must not be shown.
function effectiveRevision(member: PackageMember): MemberRevision | null {
  const latest = member.package?.revision
  if (!latest) return null
  const pin = member.hashOrTag
  if (!pin) return latest
  return latest.hash === pin || (pin.length >= 6 && latest.hash.startsWith(pin))
    ? latest
    : null
}

// Members are a fixed list, not search results, so nothing ever highlights.
const NO_MATCH_LOCATIONS: SearchHitPackage['matchLocations'] = {
  __typename: 'SearchHitPackageMatchLocations',
  comment: false,
  meta: false,
  name: false,
  workflow: false,
}

// A member shaped as a search hit for the shared package-listing leaves, plus
// what the tab itself needs. `hit.name` stays the physical package name (the
// link builder alone keeps navigation DP-local); the virtual name rides in
// `id` and is rendered via `displayName`. When the effective revision is not
// in hand (see effectiveRevision), `modified` falls back to the package-level
// date and the revision-sourced cells (size, entries, comment, workflow,
// meta) render as unknown/empty.
interface PackageItem {
  member: PackageMember
  modified: Date | null
  // null: the member's package didn't dereference (fallback row/card instead)
  hit: SearchHitPackage | null
  tableHit: SearchTableHit | null
}

function toPackageItem(member: PackageMember): PackageItem {
  const pkg = member.package
  if (!pkg) return { member, modified: null, hit: null, tableHit: null }
  const rev = effectiveRevision(member)
  const modified = rev?.modified ?? pkg.modified
  const hit: SearchHitPackage = {
    __typename: 'SearchHitPackage',
    id: member.virtualName,
    bucket: member.bucket,
    name: member.name,
    pointer: member.hashOrTag ?? 'latest',
    hash: rev?.hash ?? member.hashOrTag ?? '',
    score: 0,
    // A nullish size renders as '?' and a nullish entries count as blank —
    // honest "unknown" cells for a pinned member (the fields are typed
    // non-null only because search always has them).
    size: rev?.totalBytes ?? (null as unknown as number),
    modified,
    totalEntriesCount: rev?.totalEntries ?? (null as unknown as number),
    comment: rev?.message ?? null,
    // The card leaf expects the search wire format: meta as a JSON string.
    meta: rev?.userMeta ? JSON.stringify(rev.userMeta) : null,
    workflow: rev?.workflow?.id ? { id: rev.workflow.id } : null,
    matchLocations: NO_MATCH_LOCATIONS,
    matchingEntries: [],
  }
  return { member, modified, hit, tableHit: { ...hit, meta: rev?.userMeta ?? null } }
}

const compareItems =
  ({ key, dir }: SortSpec) =>
  (a: PackageItem, b: PackageItem): number => {
    const sign = dir === 'asc' ? 1 : -1
    if (key === 'modified') {
      // Members without package data in hand have no date — they sink to the
      // bottom regardless of direction.
      if (!a.modified && !b.modified) {
        return a.member.virtualName.localeCompare(b.member.virtualName)
      }
      if (!a.modified) return 1
      if (!b.modified) return -1
      return (a.modified.valueOf() - b.modified.valueOf()) * sign
    }
    return a.member.virtualName.localeCompare(b.member.virtualName) * sign
  }

// The static column set replicating the in-bucket table's defaults over the
// fields the members query provides. `state` is inert here (no
// configure-columns UI); `predicateType` only drives number/date
// right-alignment.
const STATIC_COLUMN_STATE = { filtered: false, visible: true, inferred: false }

const staticColumn = (
  filter: 'name' | 'modified' | 'size' | 'entries' | 'comment' | 'workflow',
  predicateType: 'KeywordWildcard' | 'Datetime' | 'Number' | 'Text' | 'KeywordEnum',
): Column => ({
  tag: ColumnTag.SystemMeta,
  filter,
  fullTitle: PACKAGE_FILTER_LABELS[filter],
  predicateType,
  state: STATIC_COLUMN_STATE,
  title: COLUMN_LABELS[filter],
})

const BASE_COLUMNS: Column[] = [
  staticColumn('name', 'KeywordWildcard'),
  staticColumn('modified', 'Datetime'),
  staticColumn('size', 'Number'),
  staticColumn('entries', 'Number'),
  staticColumn('comment', 'Text'),
]

// Appended only when at least one member's effective revision carries one.
const WORKFLOW_COLUMN = staticColumn('workflow', 'KeywordEnum')

// Numbers and dates read right-aligned, mirroring the shared table's rule
// (user-meta columns included — their type is inferred from the leaf values).
const columnAlign = (column: Column) =>
  column.tag !== ColumnTag.Bucket &&
  ['Number', 'Datetime', 'Boolean'].includes(column.predicateType)
    ? ('right' as const)
    : ('inherit' as const)

const SORTABLE_COLUMNS: readonly string[] = ['name', 'modified'] satisfies SortKey[]

// Per-member PackageLinkBuilder: every target the shared leaves can emit stays
// under /data-products/:id — physical-bucket (/b/...) routes must never be
// reachable from this tab. Most builders are unreachable today (no hash/bucket
// column, no matching entries) but are still pinned DP-local for safety.
function useMemberLinks(id: string): (virtualName: string) => PackageLinkBuilder {
  const { urls } = NamedRoutes.use()
  return React.useCallback(
    (virtualName: string): PackageLinkBuilder => {
      const root = urls.dataProductPackage(id, virtualName)
      return {
        packageRoot: () => root,
        packageDetail: () => root,
        packageEntry: (_handle, logicalKey) =>
          urls.dataProductPackage(id, virtualName, logicalKey),
        manifest: () => root,
        physicalObject: () => root,
        bucket: () => urls.dataProduct(id),
      }
    },
    [id, urls],
  )
}

interface MetaColumnsMenuProps {
  specs: MetaColumnSpec[]
  visible: Set<string>
  onToggle: (pointer: string) => void
}

// A compact show/hide menu over the derived user-meta columns — the DP-local
// stand-in for the search table's configure-columns drawer (which is bound to
// the search model). The base system-meta columns are fixed; only meta columns
// toggle. Checked state lives in the tab (in-memory, per visit).
function MetaColumnsMenu({ specs, visible, onToggle }: MetaColumnsMenuProps) {
  const classes = useStyles()
  const [anchor, setAnchor] = React.useState<HTMLElement | null>(null)
  const close = React.useCallback(() => setAnchor(null), [])
  return (
    <>
      <M.Button
        className={classes.columnsButton}
        size="small"
        onClick={(e) => setAnchor(e.currentTarget)}
        startIcon={<Icons.ViewColumn />}
      >
        Columns
      </M.Button>
      <M.Menu anchorEl={anchor} open={!!anchor} onClose={close}>
        <M.ListSubheader disableSticky>Metadata columns</M.ListSubheader>
        {specs.map((s) => (
          <M.MenuItem key={s.pointer} dense onClick={() => onToggle(s.pointer)}>
            <M.Checkbox
              checked={visible.has(s.pointer)}
              disableRipple
              edge="start"
              size="small"
              tabIndex={-1}
            />
            <M.ListItemText
              primary={s.title}
              secondary={`on ${pluralize(s.count, 'package')}`}
            />
          </M.MenuItem>
        ))}
      </M.Menu>
    </>
  )
}

// A member whose package didn't dereference (not readable or no longer
// exists) stays visible: its DP-local link plus its physical origin as plain
// provenance text.
function UnavailableNote({ member }: { member: PackageMember }) {
  return (
    <M.Typography variant="body2" color="textSecondary" component="span">
      Package data unavailable ({member.bucket}/{member.name})
    </M.Typography>
  )
}

interface PackageCardFallbackProps {
  id: string
  member: PackageMember
}

function PackageCardFallback({ id, member }: PackageCardFallbackProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Paper variant="outlined" className={classes.packageCard}>
      <Link
        to={urls.dataProductPackage(id, member.virtualName)}
        className={classes.packageName}
      >
        {member.virtualName}
      </Link>
      <UnavailableNote member={member} />
    </M.Paper>
  )
}

interface PackageRowFallbackProps {
  id: string
  member: PackageMember
  // remaining columns after the name cell + the trailing placeholder cell
  colSpan: number
}

function PackageRowFallback({ id, member, colSpan }: PackageRowFallbackProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.TableRow hover>
      <M.TableCell padding="checkbox" />
      <M.TableCell>
        <StyledLink to={urls.dataProductPackage(id, member.virtualName)}>
          {member.virtualName}
        </StyledLink>
      </M.TableCell>
      <M.TableCell colSpan={colSpan}>
        <UnavailableNote member={member} />
      </M.TableCell>
    </M.TableRow>
  )
}

interface PackagesTableProps {
  id: string
  columns: Column[]
  items: PackageItem[]
  linksFor: (virtualName: string) => PackageLinkBuilder
  sort: SortSpec
  onSort: (key: SortKey) => void
}

// The table view: shared PackageRow leaves under a hand-built head — plain
// sortable name/modified headers instead of the search table's filter-bound
// column chrome. The head shape (leading checkbox cell, trailing placeholder)
// matches what PackageRow renders.
function PackagesTable({
  id,
  columns,
  items,
  linksFor,
  sort,
  onSort,
}: PackagesTableProps) {
  const classes = useStyles()
  return (
    <M.Paper className={classes.tableRoot}>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            <M.TableCell padding="checkbox" />
            {columns.map((column) => (
              <M.TableCell
                key={column.filter}
                align={columnAlign(column)}
                className={classes.tableHeadCell}
              >
                {SORTABLE_COLUMNS.includes(column.filter) ? (
                  <M.TableSortLabel
                    active={sort.key === column.filter}
                    direction={sort.key === column.filter ? sort.dir : 'asc'}
                    onClick={() => onSort(column.filter as SortKey)}
                  >
                    {column.title}
                  </M.TableSortLabel>
                ) : (
                  column.title
                )}
              </M.TableCell>
            ))}
            <M.TableCell className={classes.tablePlaceholder} />
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {items.map((item) =>
            item.tableHit ? (
              <PackageRow
                key={item.member.virtualName}
                hit={item.tableHit}
                columnsList={columns}
                displayName={item.member.virtualName}
                links={linksFor(item.member.virtualName)}
              />
            ) : (
              <PackageRowFallback
                key={item.member.virtualName}
                id={id}
                member={item.member}
                colSpan={columns.length}
              />
            ),
          )}
        </M.TableBody>
      </M.Table>
    </M.Paper>
  )
}

function PackagesTab({ id, dp }: { id: string; dp: DataProduct }) {
  const classes = useStyles()
  const [view, setView] = useViewMode()
  const [filter, setFilter] = React.useState('')
  const [sort, setSort] = React.useState<SortSpec>({ key: 'name', dir: 'asc' })
  const [shown, setShown] = React.useState(PER_PAGE)
  const linksFor = useMemberLinks(id)

  const items = React.useMemo(
    () => dp.members.packages.map(toPackageItem),
    [dp.members.packages],
  )

  // User-meta paths derived client-side from the members' loaded userMeta
  // payloads (members whose meta is not in hand simply don't contribute).
  const meta = React.useMemo(
    () => deriveMetaColumns(items.map((i) => i.tableHit?.meta)),
    [items],
  )

  // Which meta columns show in the table. Seeded once from the coverage
  // heuristic (the member list is fixed for the life of the tab), then driven
  // by the Columns menu.
  const [visibleMeta, setVisibleMeta] = React.useState(() => defaultVisibleMeta(meta))
  const toggleMeta = React.useCallback((pointer: string) => {
    setVisibleMeta((prev) => {
      const next = new Set(prev)
      if (next.has(pointer)) next.delete(pointer)
      else next.add(pointer)
      return next
    })
  }, [])

  const columns = React.useMemo(() => {
    const base = items.some((i) => i.hit?.workflow)
      ? [...BASE_COLUMNS, WORKFLOW_COLUMN]
      : BASE_COLUMNS
    const metaColumns = meta.specs
      .filter((s) => visibleMeta.has(s.pointer))
      .map((s) =>
        ColumnUserMetaCreate(s.pointer, s.predicateType, {
          filtered: false,
          visible: true,
          inferred: true,
        }),
      )
    return metaColumns.length ? [...base, ...metaColumns] : base
  }, [items, meta.specs, visibleMeta])

  const sortValue = React.useMemo(
    () => SORT_OPTIONS.find((o) => o.valueOf() === sortToValue(sort)) || SORT_OPTIONS[0],
    [sort],
  )

  const onSortChange = React.useCallback((v: (typeof SORT_OPTIONS)[number]) => {
    const [key, dir] = v.valueOf().split(':')
    setSort({ key: key as SortKey, dir: dir as SortDir })
  }, [])

  // A header click on the active column flips direction; on another column it
  // starts from that column's natural first direction.
  const onSortKey = React.useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'modified' ? 'desc' : 'asc' },
    )
  }, [])

  // The filter input compiles into free-text name terms plus `key:value` meta
  // terms (see packagesMeta for the grammar), all AND-ed, all evaluated in
  // memory over the fixed member list.
  const compiledFilter = React.useMemo(
    () => compileFilter(filter, meta.specs),
    [filter, meta.specs],
  )

  const filtered = React.useMemo(() => {
    const { nameTerms, metaTerms } = compiledFilter
    const matched = items.filter((item) => {
      if (nameTerms.length) {
        const hay =
          `${item.member.virtualName} ${item.member.bucket}/${item.member.name}`.toLowerCase()
        if (!nameTerms.every((t) => hay.includes(t))) return false
      }
      return matchMeta(metaTerms, item.tableHit?.meta)
    })
    return matched.sort(compareItems(sort))
  }, [items, compiledFilter, sort])

  // Reveal from the top again whenever the result set changes (filter/sort).
  React.useEffect(() => setShown(PER_PAGE), [filter, sort])

  const page = filtered.slice(0, shown)

  if (!dp.members.packages.length) {
    return <M.Typography color="textSecondary">No readable packages</M.Typography>
  }

  return (
    <>
      <M.TextField
        className={classes.filterField}
        fullWidth
        size="small"
        variant="outlined"
        placeholder={
          meta.specs.length
            ? 'Filter packages — free text matches names, key:value matches metadata'
            : 'Filter packages'
        }
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        InputProps={{
          startAdornment: (
            <M.InputAdornment position="start">
              <M.Icon>search</M.Icon>
            </M.InputAdornment>
          ),
          endAdornment: !!filter && (
            <M.InputAdornment position="end">
              <M.IconButton edge="end" size="small" onClick={() => setFilter('')}>
                <M.Icon>close</M.Icon>
              </M.IconButton>
            </M.InputAdornment>
          ),
        }}
      />
      <div className={classes.toolbar}>
        <div className={classes.count}>{pluralize(filtered.length, 'package')}</div>
        <div className={classes.toolbarControls}>
          {view === 'table' && !!meta.specs.length && (
            <MetaColumnsMenu
              specs={meta.specs}
              visible={visibleMeta}
              onToggle={toggleMeta}
            />
          )}
          <Lab.ToggleButtonGroup
            className={classes.viewToggle}
            size="small"
            exclusive
            value={view}
            onChange={(_e, v) => setView(v)}
          >
            <Lab.ToggleButton value="table">
              <Icons.GridOn />
            </Lab.ToggleButton>
            <Lab.ToggleButton value="card">
              <Icons.List />
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
          <SelectDropdown
            options={SORT_OPTIONS}
            value={sortValue}
            onChange={onSortChange}
          >
            Sort by:
          </SelectDropdown>
        </div>
      </div>
      {!filtered.length ? (
        <M.Typography color="textSecondary">No packages match the filter</M.Typography>
      ) : view === 'table' ? (
        <PackagesTable
          id={id}
          columns={columns}
          items={page}
          linksFor={linksFor}
          sort={sort}
          onSort={onSortKey}
        />
      ) : (
        <div className={classes.cardList}>
          {page.map((item) =>
            item.hit ? (
              <SearchHits.Package
                key={item.member.virtualName}
                hit={item.hit}
                displayName={item.member.virtualName}
                links={linksFor(item.member.virtualName)}
                // metadata may carry s3:// strings — keep them plain text, never
                // /b/<bucket>/ links
                noS3Links
              />
            ) : (
              <PackageCardFallback
                key={item.member.virtualName}
                id={id}
                member={item.member}
              />
            ),
          )}
        </div>
      )}
      {filtered.length > shown && (
        <div className={classes.loadMore}>
          <M.Button variant="outlined" onClick={() => setShown((n) => n + PER_PAGE)}>
            Load more
          </M.Button>
        </div>
      )}
    </>
  )
}

interface PackageBrowseProps {
  id: string
  member: PackageMember
  path: string
  crumbs: BreadCrumbs.Crumb[]
}

// A package member's manifest directory, re-rooted under the DP route: the
// member's physical (bucket, name, pin) fetches the manifest, but every row
// links DP-local so browsing stays inside /data-products/:id/….
function PackageDir({ id, member, path, crumbs }: PackageBrowseProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const hashOrTag = member.hashOrTag ?? 'latest'
  const q = GQL.useQuery(DIR_QUERY, {
    bucket: member.bucket,
    name: member.name,
    hash: hashOrTag,
    path: s3paths.ensureNoSlash(path),
  })

  const renderCrumbs = () => (
    <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
      {BreadCrumbs.render(crumbs)}
    </div>
  )

  return GQL.fold(q, {
    fetching: () => (
      <>
        {renderCrumbs()}
        <M.CircularProgress />
      </>
    ),
    data: (d) => {
      const dir = d.package?.revision?.dir
      if (!dir) {
        return (
          <>
            {renderCrumbs()}
            <M.Typography color="textSecondary">
              No such directory in this package
            </M.Typography>
          </>
        )
      }
      const items: Listing.Item[] = []
      if (path) {
        const up = s3paths.up(path)
        items.push({
          type: 'dir',
          name: '..',
          to: urls.dataProductPackage(id, member.virtualName, up),
        })
      }
      dir.children.forEach((c) => {
        switch (c.__typename) {
          case 'PackageDir':
            items.push({
              type: 'dir',
              name: s3paths.ensureNoSlash(s3paths.withoutPrefix(path, c.path)),
              to: urls.dataProductPackage(
                id,
                member.virtualName,
                s3paths.ensureSlash(c.path),
              ),
              size: c.size,
            })
            break
          case 'PackageFile':
            items.push({
              type: 'file',
              name: s3paths.withoutPrefix(path, c.path),
              to: urls.dataProductPackage(id, member.virtualName, c.path),
              size: c.size,
            })
            break
          default:
            assertNever(c)
        }
      })
      return (
        <>
          {renderCrumbs()}
          {items.length ? (
            <Listing.Listing items={items} onReload={noop} />
          ) : (
            <M.Typography color="textSecondary">Empty package directory</M.Typography>
          )}
        </>
      )
    },
  })
}

// A file leaf inside a package, rendered in place under the DP route.
function PackageFile({ id, member, path, crumbs }: PackageBrowseProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const hashOrTag = member.hashOrTag ?? 'latest'
  const q = GQL.useQuery(FILE_QUERY, {
    bucket: member.bucket,
    name: member.name,
    hash: hashOrTag,
    path,
  })

  // Relative markdown links inside a previewed entry resolve to sibling
  // entries of the same package member under the DP route.
  const mkLink = React.useCallback(
    (p: string) => urls.dataProductPackage(id, member.virtualName, p),
    [id, member.virtualName, urls],
  )

  const renderCrumbs = () => (
    <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
      {BreadCrumbs.render(crumbs)}
    </div>
  )

  return GQL.fold(q, {
    fetching: () => (
      <>
        {renderCrumbs()}
        <M.CircularProgress />
      </>
    ),
    data: (d) => {
      const file = d.package?.revision?.file
      if (!file) {
        // A path that is actually a directory (e.g. a breadcrumb click without a
        // trailing slash) self-corrects to the directory view, staying DP-local.
        if (d.package?.revision?.dir) {
          return (
            <Redirect
              to={urls.dataProductPackage(
                id,
                member.virtualName,
                s3paths.ensureSlash(path),
              )}
            />
          )
        }
        return (
          <>
            {renderCrumbs()}
            <M.Typography color="textSecondary">
              No such file in this package
            </M.Typography>
          </>
        )
      }
      const loc = s3paths.parseS3Url(file.physicalKey)
      return (
        <>
          {renderCrumbs()}
          <Provenance>
            {`${member.bucket} / ${member.name}`} @{' '}
            {member.hashOrTag ? member.hashOrTag.slice(0, 10) : 'latest'} →{' '}
            {`s3://${loc.bucket}/${loc.key}`}
          </Provenance>
          <FilePreview
            handle={{
              bucket: loc.bucket,
              key: loc.key,
              version: loc.version,
              logicalKey: file.path,
            }}
            mkLink={mkLink}
          />
        </>
      )
    },
  })
}

function PackageTab({ id, dp }: { id: string; dp: DataProduct }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { pkg = '', path: rawPath = '' } = useParams<{ pkg?: string; path?: string }>()
  // The virtual name rides in a single URL segment, encoded so an author-chosen
  // name containing slashes survives the round-trip; react-router does not decode
  // params, so reverse it here.
  const virtualName = decodeURIComponent(pkg)
  const path = s3paths.decode(rawPath)

  const member = dp.members.packages.find((p) => p.virtualName === virtualName)

  const crumbs = React.useMemo(() => {
    const sep = BreadCrumbs.Crumb.Sep(<>&nbsp;/ </>)
    const getPkgRoute = (segPath: string) =>
      urls.dataProductPackage(id, virtualName, segPath)
    const inner = BreadCrumbs.getCrumbs(path, getPkgRoute, virtualName, {
      tailSeparator: path.endsWith('/'),
    })
    return [
      BreadCrumbs.Crumb.Segment({ label: dp.name, to: urls.dataProduct(id) }),
      sep,
      BreadCrumbs.Crumb.Segment({ label: 'Packages', to: urls.dataProductPackages(id) }),
      sep,
      ...inner,
    ]
  }, [dp.name, id, path, urls, virtualName])

  if (!member) {
    return (
      <>
        <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
          {BreadCrumbs.render(crumbs)}
        </div>
        <M.Typography color="textSecondary">
          No such package in this data product
        </M.Typography>
      </>
    )
  }

  return s3paths.isDir(path) ? (
    <PackageDir id={id} member={member} path={path} crumbs={crumbs} />
  ) : (
    <PackageFile id={id} member={member} path={path} crumbs={crumbs} />
  )
}

interface DataProductScreenProps {
  id: string
}

function DataProductScreen({ id }: DataProductScreenProps) {
  const classes = useStyles()
  const { paths } = NamedRoutes.use()
  const section = useSection()
  const q = GQL.useQuery(DP_QUERY, { id })

  return GQL.fold(q, {
    fetching: () => (
      <Container className={classes.content}>
        <M.CircularProgress />
      </Container>
    ),
    error: (err) => (
      <Container className={classes.content}>
        <M.Typography variant="h4" gutterBottom>
          Data product
        </M.Typography>
        <M.Typography color="error">
          Error loading data product: {err.message}
        </M.Typography>
      </Container>
    ),
    data: (data) => {
      const dp = data.dataProduct
      if (!dp) {
        return (
          <Container className={classes.content}>
            <M.Typography variant="h4" gutterBottom>
              Data product
            </M.Typography>
            <M.Typography>Data product not found</M.Typography>
          </Container>
        )
      }

      return (
        <Container className={classes.content}>
          <MetaTitle>{dp.title || dp.name}</MetaTitle>
          <M.Paper className={classes.headerCard}>
            <Header dp={dp} />
            <M.Divider />
            <div className={classes.tabsRow}>
              <Tabs id={id} section={section} />
            </div>
          </M.Paper>
          <Switch>
            <Route path={paths.dataProductObjects}>
              <ObjectsTab id={id} dp={dp} />
            </Route>
            <Route path={paths.dataProductPackage}>
              <PackageTab id={id} dp={dp} />
            </Route>
            <Route path={paths.dataProductPackages} exact>
              <PackagesTab id={id} dp={dp} />
            </Route>
            <Route path={paths.dataProduct} exact>
              <OverviewTab dp={dp} />
            </Route>
          </Switch>
        </Container>
      )
    },
  })
}

export default function DataProduct() {
  const { id } = useParams<{ id: string }>()
  return <Layout pre={<DataProductScreen id={id} />} />
}
