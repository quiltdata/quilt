import * as R from 'ramda'
import * as React from 'react'
import * as redux from 'react-redux'
import { Route, Switch, matchPath } from 'react-router-dom'
import * as M from '@material-ui/core'

import Error from 'components/Error'
import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as authSelectors from 'containers/Auth/selectors'
import { ThrowNotFound, createNotFound } from 'containers/NotFoundPage'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import * as RT from 'utils/reactTools'

import BucketNav from './BucketNav'
// import { ThrowNotFound, createNotFound } from './NotFoundPage'
import { displayError } from './errors'

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

const CatchNotFound = createNotFound(() => {
  const username = redux.useSelector(authSelectors.username)
  const helpText = username
    ? 'Try to navigate using one of these tabs above'
    : 'Do you need to log in?'
  return (
    <M.Box mt={4}>
      <Error headline="Nothing here" detail={helpText} />
    </M.Box>
  )
})

export default function Bucket({
  location,
  match: {
    params: { bucket },
  },
}) {
  const { paths } = NamedRoutes.use()
  return (
    <BucketPreferences.Provider bucket={bucket}>
      <BucketLayout bucket={bucket} section={getBucketSection(paths)(location.pathname)}>
        <CatchNotFound id={`${location.pathname}${location.search}${location.hash}`}>
          <Switch>
            <Route path={paths.bucketFile} component={File} exact strict />
            <Route path={paths.bucketDir} component={Dir} exact />
            <Route path={paths.bucketOverview} component={Overview} exact />
            <Route path={paths.bucketSearch} component={Search} exact />
            <Route path={paths.bucketPackageList} component={PackageList} exact />
            <Route path={paths.bucketPackageDetail} component={PackageTree} exact />
            <Route path={paths.bucketPackageTree} component={PackageTree} exact />
            <Route
              path={paths.bucketPackageRevisions}
              component={PackageRevisions}
              exact
            />
            <Route path={paths.bucketQueries} component={Queries} exact />
            <Route component={ThrowNotFound} />
          </Switch>
        </CatchNotFound>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}
