import cx from 'classnames'
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
import type * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as s3paths from 'utils/s3paths'

import DP_QUERY from './gql/DataProduct.generated'
import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'

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
  // never a navigation link. Above a file preview it wants bottom spacing; in a
  // package row/card the `inline` modifier drops it and adds top spacing.
  provenance: {
    marginBottom: t.spacing(2),
  },
  provenanceInline: {
    marginBottom: 0,
    marginTop: t.spacing(1),
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
  // Matches the outlined-Paper card the in-bucket package list uses per hit.
  packageCard: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    padding: t.spacing(2),
    '& + &': {
      marginTop: t.spacing(2),
    },
  },
  packageName: {
    ...t.typography.body1,
    fontWeight: t.typography.fontWeightMedium,
  },
  tableRoot: {
    overflowX: 'auto',
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

function FilePreview({ handle }: { handle: FileHandle }) {
  return (
    <Section icon="remove_red_eye" heading="Preview" expandable={false}>
      {useBucketExistence(handle.bucket).case({
        Ok: () =>
          Preview.load(handle, renderPreview(), { context: Preview.CONTEXT.FILE }),
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
function Provenance({
  children,
  inline = false,
}: React.PropsWithChildren<{ inline?: boolean }>) {
  const classes = useStyles()
  return (
    <M.Typography
      variant="caption"
      color="textSecondary"
      component="div"
      className={cx(classes.provenance, inline && classes.provenanceInline)}
    >
      Provenance: {children}
    </M.Typography>
  )
}

// Fetches + renders the README member's markdown, like a bucket overview README.
function ReadmePreview({ member }: { member: ObjectMember }) {
  const s3 = AWS.S3.use()
  const handle: Model.S3.S3ObjectLocation = React.useMemo(
    () => ({
      bucket: member.bucket,
      key: member.key,
      version: member.versionId ?? undefined,
    }),
    [member],
  )
  const data = useData(requests.fetchFile, { s3, handle })
  return data.case({
    Err: () => null,
    Ok: ({ body }: { body?: { toString: (enc: string) => string } }) => (
      <Markdown data={body?.toString('utf-8') ?? ''} />
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
          <ReadmePreview member={readmeMember} />
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

// The Packages tab replicates the in-bucket package-list presentation over the
// DP's in-hand package members (a fixed list, not a search): a filter field, a
// count + card/table toggle + sort toolbar, then a card grid or table — every
// row/card link re-rooted DP-local (urls.dataProductPackage), never a
// /b/<bucket>/ link. The in-bucket list is search-model-backed and its rows link
// into the physical bucket, so its containers can be neither fed this list nor
// reused without breaking the no-outbound-navigation invariant; hence the
// model-agnostic primitives (SelectDropdown, the ToggleButtonGroup toggle, MUI
// Paper/Table) are reused and the search-bound chrome is replicated.

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

type SortOrder = 'asc' | 'desc'

// Members carry only their virtual name + provenance in hand (no size/date), so
// the honest sort axis is the name — the A→Z / Z→A pair the bucket list also
// offers, rendered through the same SelectDropdown.
const sortOptions = [
  { toString: () => 'Name: A → Z', valueOf: (): SortOrder => 'asc' },
  { toString: () => 'Name: Z → A', valueOf: (): SortOrder => 'desc' },
]

const PER_PAGE = 30

const pinOf = (member: PackageMember) =>
  member.hashOrTag ? member.hashOrTag.slice(0, 10) : 'latest'

function PackageCard({ member, to }: { member: PackageMember; to: string }) {
  const classes = useStyles()
  return (
    <M.Paper variant="outlined" className={classes.packageCard}>
      <Link to={to} className={classes.packageName}>
        {member.virtualName}
      </Link>
      <Provenance inline>
        {`${member.bucket} / ${member.name}`} @ {pinOf(member)}
      </Provenance>
    </M.Paper>
  )
}

function PackageTable({ id, members }: { id: string; members: PackageMember[] }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.Paper className={classes.tableRoot}>
      <M.Table size="small">
        <M.TableHead>
          <M.TableRow>
            <M.TableCell>Name</M.TableCell>
            <M.TableCell>Provenance</M.TableCell>
            <M.TableCell>Revision</M.TableCell>
          </M.TableRow>
        </M.TableHead>
        <M.TableBody>
          {members.map((p) => (
            <M.TableRow key={p.virtualName} hover>
              <M.TableCell>
                <Link
                  to={urls.dataProductPackage(id, p.virtualName)}
                  className={classes.packageName}
                >
                  {p.virtualName}
                </Link>
              </M.TableCell>
              <M.TableCell>
                <M.Typography variant="body2" color="textSecondary">
                  {p.bucket} / {p.name}
                </M.Typography>
              </M.TableCell>
              <M.TableCell>
                <M.Typography variant="body2" color="textSecondary">
                  {pinOf(p)}
                </M.Typography>
              </M.TableCell>
            </M.TableRow>
          ))}
        </M.TableBody>
      </M.Table>
    </M.Paper>
  )
}

function PackagesTab({ id, dp }: { id: string; dp: DataProduct }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const [view, setView] = useViewMode()
  const [filter, setFilter] = React.useState('')
  const [order, setOrder] = React.useState<SortOrder>('asc')
  const [shown, setShown] = React.useState(PER_PAGE)

  const sortValue = React.useMemo(
    () => sortOptions.find((o) => o.valueOf() === order) || sortOptions[0],
    [order],
  )

  const filtered = React.useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const matched = needle
      ? dp.members.packages.filter(
          (p) =>
            p.virtualName.toLowerCase().includes(needle) ||
            `${p.bucket}/${p.name}`.toLowerCase().includes(needle),
        )
      : dp.members.packages.slice()
    return [...matched].sort((a, b) =>
      order === 'asc'
        ? a.virtualName.localeCompare(b.virtualName)
        : b.virtualName.localeCompare(a.virtualName),
    )
  }, [dp.members.packages, filter, order])

  // Reveal from the top again whenever the result set changes (filter/sort).
  React.useEffect(() => setShown(PER_PAGE), [filter, order])

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
            <Lab.ToggleButton value="table">
              <Icons.GridOn />
            </Lab.ToggleButton>
            <Lab.ToggleButton value="card">
              <Icons.List />
            </Lab.ToggleButton>
          </Lab.ToggleButtonGroup>
          <SelectDropdown
            options={sortOptions}
            value={sortValue}
            onChange={(v) => setOrder(v.valueOf())}
          >
            Sort by:
          </SelectDropdown>
        </div>
      </div>
      {!filtered.length ? (
        <M.Typography color="textSecondary">No packages match the filter</M.Typography>
      ) : view === 'table' ? (
        <PackageTable id={id} members={page} />
      ) : (
        <div>
          {page.map((p) => (
            <PackageCard
              key={p.virtualName}
              member={p}
              to={urls.dataProductPackage(id, p.virtualName)}
            />
          ))}
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
