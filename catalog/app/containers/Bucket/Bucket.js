import * as R from 'ramda'
import * as React from 'react'
import { Link, Route, Switch, matchPath } from 'react-router-dom'
import * as RC from 'recompose'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound } from 'containers/NotFoundPage'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import { useData } from 'utils/Data'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

import { displayError } from './errors'
import * as requests from './requests'

const mkLazy = (load) =>
  RT.loadable(load, { fallback: () => <Placeholder color="text.secondary" /> })

const Dir = mkLazy(() => import('./Dir'))
const File = mkLazy(() => import('./File'))
const Overview = mkLazy(() => import('./Overview'))
const PackageList = mkLazy(() => import('./PackageList'))
const PackageRevisions = mkLazy(() => import('./PackageRevisions'))
const PackageTree = mkLazy(() => import('./PackageTree'))
const Queries = mkLazy(() => import('./Queries'))
const Search = mkLazy(() => import('./Search'))

const match = (cases) => (pathname) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [section, variants] of Object.entries(cases)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const opts of variants) {
      if (matchPath(pathname, opts)) return section
    }
  }
  return false
}

const sections = {
  overview: { path: 'bucketOverview', exact: true },
  packages: { path: 'bucketPackageList' },
  tree: [
    { path: 'bucketFile', exact: true, strict: true },
    { path: 'bucketDir', exact: true },
  ],
  queries: { path: 'bucketQueries', exact: true },
  search: { path: 'bucketSearch', exact: true },
}

const getBucketSection = (paths) =>
  match(
    R.map(
      (variants) => [].concat(variants).map(R.evolve({ path: (p) => paths[p] })),
      sections,
    ),
  )

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

function useWorkflowsConfig(bucket, options) {
  const s3 = AWS.S3.use()
  return useData(requests.workflowsConfig, { s3, bucket }, options)
}

function BucketNav({ bucket, section = false }) {
  const workflowsConfigData = useWorkflowsConfig(bucket)
  const { urls } = NamedRoutes.use()

  return workflowsConfigData.case({
    Ok: (workflowsConfig) => (
      <M.Tabs value={section} centered>
        {workflowsConfig.ui.nav.overview && (
          <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
        )}
        {workflowsConfig.ui.nav.files && (
          <NavTab label="Files" value="tree" to={urls.bucketDir(bucket)} />
        )}
        {workflowsConfig.ui.nav.packages && (
          <NavTab label="Packages" value="packages" to={urls.bucketPackageList(bucket)} />
        )}
        {workflowsConfig.ui.nav.queries && (
          <NavTab label="Queries" value="queries" to={urls.bucketQueries(bucket)} />
        )}
        {section === 'search' && (
          <NavTab label="Search" value="search" to={urls.bucketSearch(bucket)} />
        )}
      </M.Tabs>
    ),
    Err: () => null,
    _: () => null,
  })
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

function BucketLayout({ bucket, section = false, children }) {
  const classes = useStyles()
  const bucketExistenceData = useBucketExistence(bucket)
  return (
    <Layout
      pre={
        <>
          <M.AppBar position="static" className={classes.appBar}>
            <BucketNav bucket={bucket} section={section} />
          </M.AppBar>
          <M.Container maxWidth="lg">
            {bucketExistenceData.case({
              Ok: () => children,
              Err: displayError(),
              _: () => <Placeholder color="text.secondary" />,
            })}
          </M.Container>
        </>
      }
    />
  )
}

export default function Bucket({
  location,
  match: {
    params: { bucket },
  },
}) {
  const { paths } = NamedRoutes.use()
  return (
    <BucketLayout bucket={bucket} section={getBucketSection(paths)(location.pathname)}>
      <Switch>
        <Route path={paths.bucketFile} component={File} exact strict />
        <Route path={paths.bucketDir} component={Dir} exact />
        <Route path={paths.bucketOverview} component={Overview} exact />
        <Route path={paths.bucketSearch} component={Search} exact />
        <Route path={paths.bucketPackageList} component={PackageList} exact />
        <Route path={paths.bucketPackageDetail} component={PackageTree} exact />
        <Route path={paths.bucketPackageTree} component={PackageTree} exact />
        <Route path={paths.bucketPackageRevisions} component={PackageRevisions} exact />
        <Route path={paths.bucketQueries} component={Queries} exact />
        <Route component={ThrowNotFound} />
      </Switch>
    </BucketLayout>
  )
}
