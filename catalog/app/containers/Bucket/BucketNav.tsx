import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import type * as Routes from 'constants/routes'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as SearchUIModel from 'containers/Search/model'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'

import Stats from './Stats'

const useNavTabStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(8),
    minWidth: 120,
  },
}))

export interface RouteMap {
  bucketDir: Routes.BucketDirArgs
  bucketESQueries: Routes.BucketESQueriesArgs
  bucketFile: Routes.BucketFileArgs
  bucketOverview: Routes.BucketOverviewArgs
  bucketPackageDetail: Routes.BucketPackageDetailArgs
  bucketPackageList: Routes.BucketPackageListArgs
  bucketPackageRevisions: Routes.BucketPackageRevisionsArgs
  bucketPackageTree: Routes.BucketPackageTreeArgs
  bucketQueries: Routes.BucketQueriesArgs
  bucketWorkflowDetail: Routes.BucketWorkflowDetailArgs
  bucketWorkflowList: Routes.BucketWorkflowListArgs
}

export type Section = 'es' | 'overview' | 'packages' | 'queries' | 'tree' | 'workflows'

type NavTabProps = Omit<React.ComponentProps<typeof M.Tab>, 'value'> &
  React.ComponentProps<typeof Link> & { value: Section }

function NavTab(props: NavTabProps) {
  const classes = useNavTabStyles()

  return <M.Tab className={classes.root} component={Link} {...props} />
}

const useBucketNavSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    justifyContent: 'center',
  },
  item: {
    height: t.spacing(3),
    margin: t.spacing(3, 3, 2),
    width: t.spacing(10),
  },
}))

function BucketNavSkeleton() {
  const classes = useBucketNavSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skeleton className={classes.item} animate />
      <Skeleton className={classes.item} animate />
      <Skeleton className={classes.item} animate />
    </div>
  )
}

function useSearchUIModel() {
  return React.useContext(SearchUIModel.Context)
}

const useTabsStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex ',
    justifyContent: 'space-between',
    [t.breakpoints.down('sm')]: {
      flexDirection: 'column',
    },
  },
  stats: {
    [t.breakpoints.down('sm')]: {
      borderBottom: `1px solid ${t.palette.divider}`,
      padding: t.spacing(0.5, 0),
    },
  },
}))

interface TabsProps {
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: Section | boolean
}

function Tabs({ bucket, preferences, section = false }: TabsProps) {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const { urls } = NamedRoutes.use<RouteMap>()
  const classes = useTabsStyles()
  const ref = React.useRef<M.TabsActions | null>(null)
  React.useEffect(() => {
    const timer = setTimeout(() => ref.current?.updateIndicator(), 300)
    return () => clearInterval(timer)
  }, [])
  return (
    <div className={classes.root}>
      <Stats bucket={bucket} className={classes.stats} />
      <M.Tabs value={section} variant="scrollable" scrollButtons="auto" action={ref}>
        <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
        {preferences.files && (
          <NavTab label="Bucket" value="tree" to={urls.bucketDir(bucket)} />
        )}
        {preferences.workflows && (
          <NavTab
            label="Workflows"
            value="workflows"
            to={urls.bucketWorkflowList(bucket)}
          />
        )}
        {preferences.packages && (
          <NavTab label="Packages" value="packages" to={urls.bucketPackageList(bucket)} />
        )}
        {preferences.queries && authenticated && (
          <NavTab label="Queries" value="queries" to={urls.bucketQueries(bucket)} />
        )}
        {preferences.queries && (section === 'queries' || section === 'es') && (
          <NavTab label="ElasticSearch" value="es" to={urls.bucketESQueries(bucket)} />
        )}
      </M.Tabs>
    </div>
  )
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

interface BucketNavProps {
  bucket: string
  section: Section | false
}

export default function BucketNav({ bucket, section = false }: BucketNavProps) {
  const classes = useStyles()
  const searchUIModel = useSearchUIModel()
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { nav } }) => (
        <M.AppBar position="static" className={classes.appBar}>
          <M.Container
            maxWidth={
              searchUIModel?.state.view === SearchUIModel.View.Table ? false : 'lg'
            }
          >
            <Tabs bucket={bucket} preferences={nav} section={section} />
          </M.Container>
        </M.AppBar>
      ),
      Pending: () => <BucketNavSkeleton />,
      Init: () => null,
    },
    prefs,
  )
}
