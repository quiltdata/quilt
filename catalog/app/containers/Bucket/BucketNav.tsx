import * as React from 'react'
import { Link } from 'react-router-dom'
import * as RC from 'recompose'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'
import * as workflows from 'utils/workflows'

import * as requests from './requests'

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

function useWorkflowsConfig(bucket: string) {
  const s3 = AWS.S3.use()
  return useData(requests.workflowsConfig, { s3, bucket })
}

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
  preferences: workflows.NavPreferences
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
  const workflowsConfigData = useWorkflowsConfig(bucket)

  return workflowsConfigData.case({
    Ok: (workflowsConfig: workflows.WorkflowsConfig) => (
      <Tabs bucket={bucket} preferences={workflowsConfig.ui.nav} section={section} />
    ),
    Err: () => (
      <Tabs
        bucket={bucket}
        preferences={workflows.emptyConfig.ui.nav}
        section={section}
      />
    ),
    _: () => <BucketNavSkeleton />,
  })
}
