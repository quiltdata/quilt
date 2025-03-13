import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'

const useStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(8),
    minWidth: 120,
  },
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  const classes = useStyles()

  return <M.Tab className={classes.root} component={Link} {...props} />
}

interface BucketNavProps {
  bucket: string
  section: 'es' | 'overview' | 'packages' | 'queries' | 'tree' | 'workflows' | false // `keyof` sections object
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

interface TabsProps {
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: string | boolean
}

function Tabs({ bucket, preferences, section = false }: TabsProps) {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const { urls } = NamedRoutes.use()
  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))
  return (
    <M.Tabs
      value={section}
      centered={!sm}
      variant={sm ? 'scrollable' : 'standard'}
      scrollButtons="auto"
    >
      <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
      {preferences.files && (
        <NavTab label="Bucket" value="tree" to={urls.bucketDir(bucket)} />
      )}
      <NavTab label="Workflows" value="workflows" to={urls.bucketWorkflowList(bucket)} />
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
  )
}

export default function BucketNav({ bucket, section = false }: BucketNavProps) {
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { nav } }) => (
        <Tabs bucket={bucket} preferences={nav} section={section} />
      ),
      Pending: () => <BucketNavSkeleton />,
      Init: () => null,
    },
    prefs,
  )
}
