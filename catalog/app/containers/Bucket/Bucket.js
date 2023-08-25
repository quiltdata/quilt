import * as R from 'ramda'
import * as React from 'react'
import { Route, Routes, matchPath, useLocation, useParams } from 'react-router-dom'
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

function FileOrDir() {
  const { ['*']: path } = useParams()
  const isDir = !path || path?.endsWith('/')
  return isDir ? <Dir /> : <File />
}

const match = (cases) => (pathname) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [section, variants] of Object.entries(cases)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const opts of variants) {
      if (matchPath(opts, pathname)) return section
    }
  }
  return false
}

const sections = {
  es: { path: 'bucketESQueries' },
  overview: { path: 'bucketOverview' },
  packages: [
    { path: 'bucketPackageList' },
    { path: 'bucketPackageDetail' },
    { path: 'bucketPackageTree' },
  ],
  tree: [{ path: 'bucketFile' }, { path: 'bucketDir' }],
  queries: { path: 'bucketQueries' },
}

const getBucketSection = (paths) =>
  match(
    R.map(
      (variants) =>
        []
          .concat(variants)
          .map(R.evolve({ path: (p) => paths.bucketRoot.replace('*', '') + paths[p] })),
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
          <Routes>
            <Route path={paths.bucketOverview} element={<Overview />} />
            <Route path={paths.bucketDir} element={<FileOrDir />} />
            <Route path={paths.bucketPackageDetail} element={<PackageTree />} />
            <Route path={paths.bucketPackageList} element={<PackageList />} />
            <Route path={paths.bucketPackageTree} element={<PackageTree />} />
            <Route path={paths.bucketPackageRevisions} element={<PackageRevisions />} />
            <Route path={paths.bucketQueries} element={<Queries />} />
            <Route path="*" element={<ThrowNotFound />} />
          </Routes>
        </CatchNotFound>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}
