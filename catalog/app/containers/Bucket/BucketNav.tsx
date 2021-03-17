import * as React from 'react'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'
import * as bucketPreferences from 'utils/bucketPreferences'

const NavTab = RT.composeComponent(
  'Bucket.Layout.Tab',
  M.withStyles((t) => ({
    root: {
      minHeight: t.spacing(8),
      minWidth: 120,
    },
  })),
  RC.withProps({ component: Link }),
  M.Tab,
)

interface BucketNavProps {
  bucket: string
  section: string | boolean
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
  preferences: bucketPreferences.NavPreferences
  section: string | boolean
}

function Tabs({ bucket, preferences, section = false }: TabsProps) {
  const { urls } = NamedRoutes.use()
  return (
    <M.Tabs value={section} centered>
      {preferences.overview && (
        <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
      )}
      {preferences.files && (
        <NavTab label="Files" value="tree" to={urls.bucketDir(bucket)} />
      )}
      {preferences.packages && (
        <NavTab label="Packages" value="packages" to={urls.bucketPackageList(bucket)} />
      )}
      {preferences.queries && (
        <NavTab label="Queries" value="queries" to={urls.bucketQueries(bucket)} />
      )}
      {section === 'search' && (
        <NavTab label="Search" value="search" to={urls.bucketSearch(bucket)} />
      )}
    </M.Tabs>
  )
}

export default function BucketNav({ bucket, section = false }: BucketNavProps) {
  const preferences = bucketPreferences.useBucketPreferences(bucket)

  if (!preferences) return <BucketNavSkeleton />

  return <Tabs bucket={bucket} preferences={preferences.ui.nav} section={section} />
}
