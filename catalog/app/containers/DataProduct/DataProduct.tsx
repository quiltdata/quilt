import * as React from 'react'
import { Link, Route, Switch, matchPath, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BreadCrumbs from 'components/BreadCrumbs'
import Layout, { Container } from 'components/Layout'
import * as Listing from 'containers/Bucket/Listing'
import * as GQL from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import DP_QUERY from './gql/DataProduct.generated'
import type { containers_DataProduct_gql_DataProductQuery as DataProductQuery } from './gql/DataProduct.generated'

type DataProduct = NonNullable<DataProductQuery['dataProduct']>

// The Listing rows are plain navigation links; nothing here mutates, so reload
// is a no-op.
const noop = () => {}

const pluralize = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`

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
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  return <M.Tab component={Link} {...props} />
}

// The tail of the current route selects the active tab, exactly as the bucket
// page's tab tracks its route.
function useSection(): string {
  const { paths } = NamedRoutes.use()
  const { pathname } = useLocation()
  if (matchPath(pathname, { path: paths.dataProductPackages, exact: true })) {
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
      <M.Typography variant="h5">{dp.name}</M.Typography>
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

function OverviewTab({ dp }: { dp: DataProduct }) {
  const classes = useStyles()
  const summary = [
    pluralize(dp.members.packages.length, 'package'),
    pluralize(dp.members.objects.length, 'object'),
  ].join(' · ')
  return (
    <M.Paper className={classes.section}>
      {/* The v0 SDL exposes no authored own-content (title/description/README)
          for a DataProduct, so there is nothing to render here yet. */}
      <M.Typography color="textSecondary">No description</M.Typography>
      <M.Box mt={2}>
        <M.Typography variant="subtitle2" gutterBottom>
          Members
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          {summary}
        </M.Typography>
      </M.Box>
      <M.Box mt={2}>
        <M.Typography variant="subtitle2" gutterBottom>
          Owner
        </M.Typography>
        <M.Typography variant="body2" color="textSecondary">
          {dp.ownerRole.name}
        </M.Typography>
      </M.Box>
    </M.Paper>
  )
}

function ObjectsTab({ id, dp }: { id: string; dp: DataProduct }) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const { path = '' } = useParams<{ path?: string }>()

  // Synthesize the immediate children of the current virtual folder from the
  // flat object members' logical keys: a remainder with a '/' is a virtual dir
  // (deduped), otherwise a leaf file that opens in place at the native view.
  const items = React.useMemo(() => {
    const seenDirs = new Set<string>()
    const result: Listing.Item[] = []
    dp.members.objects.forEach((o) => {
      if (!o.logicalKey.startsWith(path)) return
      const rest = o.logicalKey.slice(path.length)
      if (!rest) return
      const slash = rest.indexOf('/')
      if (slash === -1) {
        result.push({
          type: 'file',
          name: rest,
          to: urls.bucketFile(
            o.bucket,
            o.key,
            o.versionId ? { version: o.versionId } : undefined,
          ),
        })
      } else {
        const seg = rest.slice(0, slash)
        if (seenDirs.has(seg)) return
        seenDirs.add(seg)
        result.push({
          type: 'dir',
          name: seg,
          to: urls.dataProductObjects(id, path + seg + '/'),
        })
      }
    })
    return result
  }, [dp.members.objects, id, path, urls])

  const getSegmentRoute = React.useCallback(
    (segPath: string) => urls.dataProductObjects(id, segPath),
    [id, urls],
  )
  const crumbs = BreadCrumbs.use(path, getSegmentRoute, dp.name)

  return (
    <>
      <div className={classes.crumbs} onCopy={BreadCrumbs.copyWithoutSpaces}>
        {BreadCrumbs.render(crumbs)}
      </div>
      {items.length ? (
        <Listing.Listing items={items} onReload={noop} />
      ) : (
        <M.Typography color="textSecondary">No readable objects</M.Typography>
      )}
    </>
  )
}

function PackagesTab({ dp }: { dp: DataProduct }) {
  const { urls } = NamedRoutes.use()
  const items: Listing.Item[] = dp.members.packages.map((p) => ({
    type: 'dir',
    name: p.virtualName,
    to: urls.bucketPackageTree(p.bucket, p.name, p.hashOrTag ?? undefined),
  }))
  return items.length ? (
    <Listing.Listing items={items} onReload={noop} />
  ) : (
    <M.Typography color="textSecondary">No readable packages</M.Typography>
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
          <MetaTitle>{dp.name}</MetaTitle>
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
            <Route path={paths.dataProductPackages}>
              <PackagesTab dp={dp} />
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
