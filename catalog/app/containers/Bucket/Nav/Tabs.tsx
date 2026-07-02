import * as React from 'react'
import { Link } from 'react-router-dom'
import * as redux from 'react-redux'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AuthSelectors from 'containers/Auth/selectors'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'

import { useBucketSection } from './useBucketSection'

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  return <M.Tab component={Link} {...props} />
}

const useSkeletonStyles = M.makeStyles((t) => ({
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

function TabsSkeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skeleton className={classes.item} animate />
      <Skeleton className={classes.item} animate />
      <Skeleton className={classes.item} animate />
    </div>
  )
}

interface TabsListProps {
  bucket: string
  preferences: BucketPreferences.NavPreferences
  section: string | boolean
}

function TabsList({ bucket, preferences, section = false }: TabsListProps) {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const { urls } = NamedRoutes.use()
  return (
    // The redesigned in-volume nav: Overview / Objects / Packages.
    // "Bucket" (the file tree) reads as "Objects"; Workflows folds into
    // Packages; Queries left the tab bar for the global Tables rail entry.
    // The Queries/ES tabs only surface while you're on those routes so
    // deep links and the workbench remain reachable.
    <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
      <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
      {preferences.files && (
        <NavTab label="Objects" value="tree" to={urls.bucketDir(bucket)} />
      )}
      {preferences.packages && (
        <NavTab label="Packages" value="packages" to={urls.bucketPackageList(bucket)} />
      )}
      {preferences.workflows && section === 'workflows' && (
        <NavTab
          label="Workflows"
          value="workflows"
          to={urls.bucketWorkflowList(bucket)}
        />
      )}
      {preferences.queries && authenticated && section === 'queries' && (
        <NavTab label="Tables" value="queries" to={urls.bucketQueries(bucket)} />
      )}
      {preferences.queries && section === 'es' && (
        <NavTab label="ElasticSearch" value="es" to={urls.bucketESQueries(bucket)} />
      )}
    </M.Tabs>
  )
}

interface TabsProps {
  bucket: string
}

// Horizontal per-bucket navigation tabs, rendered on the bucket page.
export function Tabs({ bucket }: TabsProps) {
  const section = useBucketSection()
  const { prefs } = BucketPreferences.use()
  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { nav } }) => (
        <TabsList bucket={bucket} preferences={nav} section={section} />
      ),
      Pending: () => <TabsSkeleton />,
      Init: () => null,
    },
    prefs,
  )
}
