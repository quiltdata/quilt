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
import Empty from 'components/Empty'
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
import { ColumnTag, PackageRow } from 'containers/Search/Table/Table'
import type { Column, PackageLinkBuilder } from 'containers/Search/Table/Table'
import { COLUMN_LABELS, PACKAGE_FILTER_LABELS } from 'containers/Search/i18n'
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import { useData } from 'utils/Data'
import * as Format from 'utils/format'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as Resource from 'utils/Resource'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import DP_QUERY from './gql/DataProduct.generated'
import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'
import { toPackageItem } from './packageItems'
import type { PackageItem, PackageMember } from './packageItems'

type DataProduct = NonNullable<DataProductQuery['dataProduct']>
type ObjectMember = DataProduct['members']['objects'][number]

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
  // Only three short, fixed tabs — let them size to content so the strip never
  // needs to scroll at the narrow (<=800px) content widths the persistent
  // sidebar leaves; the 160px sm-breakpoint floor would otherwise overflow and
  // force scroll mode.
  tab: {
    minWidth: 0,
    [t.breakpoints.up('sm')]: {
      minWidth: 0,
    },
  },
  // Belt-and-suspenders for any residual overflow: a disabled scroll chevron
  // (e.g. the left one at the start) collapses to zero width instead of
  // occupying 40px and clipping the first tab into a sliver.
  tabScrollButtons: {
    '&.Mui-disabled': {
      width: 0,
    },
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
  // The card/table switch and the Sort dropdown sit at the right of the
  // toolbar, same height and vertically centered — mirroring the in-bucket
  // package-list toolbar (containers/Search/Layout/Results.tsx). The gap
  // between them matches the search toolbar's inter-control spacing.
  viewToggle: {
    marginRight: t.spacing(1),
  },
  // The small ToggleButtons default to a taller box than the small outlined
  // SelectDropdown button; this padding + border color pins them to the same
  // height (the exact idiom from Search/Layout/Results.tsx ToggleResultsView).
  toggleButton: {
    padding: '5px',
    borderColor: 'rgba(0, 0, 0, 0.23)',
  },
  // Matches the in-bucket Sort toolbar: the value reads visually distinct from
  // the "Sort by:" label, with a space before it (see containers/Search/Sort).
  sortValue: {
    fontWeight: t.typography.fontWeightMedium,
    marginLeft: t.spacing(0.5),
  },
  // The home-page "no results" idiom: a large heading that echoes the query,
  // rather than a small muted body line.
  noMatch: {
    marginTop: t.spacing(4),
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
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Tabs
      value={section}
      variant="scrollable"
      scrollButtons="auto"
      classes={{ scrollButtons: classes.tabScrollButtons }}
    >
      <NavTab
        className={classes.tab}
        label="Overview"
        value="overview"
        to={urls.dataProduct(id)}
      />
      <NavTab
        className={classes.tab}
        label="Files"
        value="objects"
        to={urls.dataProductObjects(id)}
      />
      <NavTab
        className={classes.tab}
        label="Packages"
        value="packages"
        to={urls.dataProductPackages(id)}
      />
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
        <Stat label="Created">
          <M.Tooltip arrow title={dp.createdAt.toLocaleString()}>
            <span>
              <Format.Relative value={dp.createdAt} />
            </span>
          </M.Tooltip>
        </Stat>
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
  // react-router hands back the raw percent-encoded param; dataProductObjects
  // encodes per segment (like dataProductPackage), so decode it back here the
  // way PackageTab decodes its inner path — see below.
  const { path: rawPath = '' } = useParams<{ path?: string }>()
  const path = s3paths.decode(rawPath)

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
        // Object members carry no size on the registry today (only the package
        // tree does), so the shared listing would total them to a misleading
        // "0 B". Hide the size affordance until a registry size increment lands
        // (deferred) rather than showing zeros.
        <Listing.Listing items={items} onReload={noop} hideSize />
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
// hit-shaped rows synthesized from the members. The table columns are a fixed
// system-meta set (name, modified, size, files, comment — plus workflow when a
// member carries one); the filter is a plain substring match over the package
// name. Every link is re-rooted DP-local through the leaves'
// `PackageLinkBuilder` seam (urls.dataProductPackage) — never a /b/<bucket>/
// route; the search-model-bound chrome (facet drawer, server-side facets,
// configurable columns, matching-entries expansion) is intentionally absent,
// and the tab is read-only (no authoring affordances).

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

const compareItems =
  ({ key, dir }: SortSpec) =>
  (a: PackageItem, b: PackageItem): number => {
    const sign = dir === 'asc' ? 1 : -1
    if (key === 'modified') {
      // Members without package data in hand have no date — they sink to the
      // bottom regardless of direction.
      if (!a.modified && !b.modified) {
        return a.member.name.localeCompare(b.member.name)
      }
      if (!a.modified) return 1
      if (!b.modified) return -1
      return (a.modified.valueOf() - b.modified.valueOf()) * sign
    }
    return a.member.name.localeCompare(b.member.name) * sign
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
        {member.name}
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
          {member.name}
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
                displayName={item.member.name}
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
  // Default to 'Most recent first', parity with the in-bucket package list.
  const [sort, setSort] = React.useState<SortSpec>({ key: 'modified', dir: 'desc' })
  const [shown, setShown] = React.useState(PER_PAGE)
  const linksFor = useMemberLinks(id)

  const items = React.useMemo(
    () => dp.members.packages.map(toPackageItem),
    [dp.members.packages],
  )

  // A fixed system-meta column set (no configure-columns UI): the base columns
  // plus the workflow column only when some member's effective revision carries
  // one.
  const columns = React.useMemo(
    () =>
      items.some((i) => i.hit?.workflow)
        ? [...BASE_COLUMNS, WORKFLOW_COLUMN]
        : BASE_COLUMNS,
    [items],
  )

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

  // A plain case-insensitive substring match over the full prefix/suffix
  // package name (virtualName), evaluated in memory over the fixed member list.
  const filtered = React.useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const matched = items.filter(
      (item) => !needle || item.member.name.toLowerCase().includes(needle),
    )
    return matched.sort(compareItems(sort))
  }, [items, filter, sort])

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
        placeholder="Filter packages"
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
          <Lab.ToggleButtonGroup
            className={classes.viewToggle}
            size="small"
            exclusive
            value={view}
            onChange={(_e, v) => setView(v)}
          >
            <Lab.ToggleButton
              value="table"
              aria-label="Table view"
              classes={{ root: classes.toggleButton }}
            >
              <Icons.GridOn />
            </Lab.ToggleButton>
            <Lab.ToggleButton
              value="card"
              aria-label="List view"
              classes={{ root: classes.toggleButton }}
            >
              <Icons.List />
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
          <SelectDropdown
            options={SORT_OPTIONS}
            value={sortValue}
            onChange={onSortChange}
            classes={{ value: classes.sortValue }}
            // The in-bucket Sort toolbar (Search/Layout/Results.tsx) renders a
            // medium outlined button; pairing it with the padding-5 toggle
            // idiom lands both controls at the same 36px height.
            ButtonProps={{ size: 'medium' }}
          >
            Sort by:
          </SelectDropdown>
        </div>
      </div>
      {!filtered.length ? (
        <Empty
          className={classes.noMatch}
          title={
            filter.trim()
              ? `No packages matching "${filter.trim()}"`
              : 'No packages match'
          }
        />
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
                displayName={item.member.name}
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
    // The package crumb shows the physical prefix/suffix name (the package's
    // real identity); the URL segment stays the virtual name.
    const inner = BreadCrumbs.getCrumbs(path, getPkgRoute, member?.name ?? virtualName, {
      tailSeparator: path.endsWith('/'),
    })
    return [
      BreadCrumbs.Crumb.Segment({ label: dp.name, to: urls.dataProduct(id) }),
      sep,
      BreadCrumbs.Crumb.Segment({ label: 'Packages', to: urls.dataProductPackages(id) }),
      sep,
      ...inner,
    ]
  }, [dp.name, id, path, urls, virtualName, member?.name])

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
