import * as R from 'ramda'
import * as React from 'react'
import { Route, Switch, matchPath, useLocation, useParams } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound } from 'containers/NotFoundPage'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as RT from 'utils/reactTools'

import BucketNav from './BucketNav'
import CatchNotFound from './CatchNotFound'
import * as Selection from './Selection'
import { displayError } from './errors'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Dir = RT.mkLazy(() => import('./Dir'), SuspensePlaceholder)
const File = RT.mkLazy(() => import('./File'), SuspensePlaceholder)
const Overview = RT.mkLazy(() => import('./Overview'), SuspensePlaceholder)
const PackageList = RT.mkLazy(() => import('./PackageList'), SuspensePlaceholder)
const PackageRevisions = RT.mkLazy(
  () => import('./PackageRevisions'),
  SuspensePlaceholder,
)
const PackageTree = RT.mkLazy(() => import('./PackageTree'), SuspensePlaceholder)
const Queries = RT.mkLazy(() => import('./Queries'), SuspensePlaceholder)
const Workflows = RT.mkLazy(() => import('./Workflows'), SuspensePlaceholder)

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
  es: { path: 'bucketESQueries', exact: true },
  overview: { path: 'bucketOverview', exact: true },
  packages: { path: 'bucketPackageList' },
  tree: [
    { path: 'bucketFile', exact: true, strict: true },
    { path: 'bucketDir', exact: true },
  ],
  queries: { path: 'bucketQueries' },
  workflows: { path: 'bucketWorkflowList' },
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

export default function Bucket() {
  const location = useLocation()
  const { bucket } = useParams()
  const { paths } = NamedRoutes.use()
  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <BucketLayout bucket={bucket} section={getBucketSection(paths)(location.pathname)}>
        <CatchNotFound id={`${location.pathname}${location.search}${location.hash}`}>
          <Switch>
            <Route path={paths.bucketFile} exact strict>
              <File />
            </Route>
            <Route path={paths.bucketDir} exact>
              <Selection.Provider>
                <Dir />
              </Selection.Provider>
            </Route>
            <Route path={paths.bucketOverview} exact>
              <Overview />
            </Route>
            <Route path={paths.bucketPackageList} exact>
              <PackageList />
            </Route>
            <Route path={paths.bucketPackageDetail} exact>
              <PackageTree />
            </Route>
            <Route path={paths.bucketPackageTree} exact>
              <PackageTree />
            </Route>
            <Route path={paths.bucketPackageRevisions} exact>
              <PackageRevisions />
            </Route>
            <Route path={paths.bucketWorkflowList} exact>
              <Workflows />
            </Route>
            <Route path={paths.bucketWorkflowDetail} exact>
              <Workflows />
            </Route>
            <Route path={paths.bucketQueries}>
              <Queries />
            </Route>
            <Route>
              <ThrowNotFound />
            </Route>
          </Switch>
        </CatchNotFound>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}
