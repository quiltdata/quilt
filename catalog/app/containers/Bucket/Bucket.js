import * as R from 'ramda'
import * as React from 'react'
import { Switch, matchPath } from 'react-router-dom'
import * as RRDomCompat from 'react-router-dom-v5-compat'
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
const Search = RT.mkLazy(() => import('./Search'), SuspensePlaceholder)

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

export default function Bucket() {
  const { bucket } = RRDomCompat.useParams()
  const location = RRDomCompat.useLocation()

  const { paths } = NamedRoutes.use()
  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <BucketLayout bucket={bucket} section={getBucketSection(paths)(location.pathname)}>
        <CatchNotFound id={`${location.pathname}${location.search}${location.hash}`}>
          <Switch>
            <RRDomCompat.CompatRoute
              path={paths.bucketFile}
              component={File}
              exact
              strict
            />
            <RRDomCompat.CompatRoute path={paths.bucketDir} component={Dir} exact />
            <RRDomCompat.CompatRoute
              path={paths.bucketOverview}
              component={Overview}
              exact
            />
            <RRDomCompat.CompatRoute path={paths.bucketSearch} component={Search} exact />
            <RRDomCompat.CompatRoute
              path={paths.bucketPackageList}
              component={PackageList}
              exact
            />
            <RRDomCompat.CompatRoute
              path={paths.bucketPackageDetail}
              component={PackageTree}
              exact
            />
            <RRDomCompat.CompatRoute
              path={paths.bucketPackageTree}
              component={PackageTree}
              exact
            />
            <RRDomCompat.CompatRoute
              path={paths.bucketPackageRevisions}
              component={PackageRevisions}
              exact
            />
            <RRDomCompat.CompatRoute path={paths.bucketQueries} component={Queries} />
            <RRDomCompat.CompatRoute component={ThrowNotFound} />
          </Switch>
        </CatchNotFound>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}
