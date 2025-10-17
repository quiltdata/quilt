import * as React from 'react'
import { Route, Switch, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { useBucketStrict } from 'containers/Bucket/Routes'
import { ThrowNotFound } from 'containers/NotFoundPage'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as RT from 'utils/reactTools'

import * as AssistantContext from './AssistantContext'
import * as BucketNav from './BucketNav'
import CatchNotFound from './CatchNotFound'
import type { RouteMap } from './Routes'
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
const PackageCompare = RT.mkLazy(() => import('./PackageCompare'), SuspensePlaceholder)
const PackageTree = RT.mkLazy(() => import('./PackageTree'), SuspensePlaceholder)
const Queries = RT.mkLazy(() => import('./Queries'), SuspensePlaceholder)
const Workflows = RT.mkLazy(() => import('./Workflows'), SuspensePlaceholder)

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

interface BucketLayoutProps {
  bucket: string
  children: React.ReactNode
}

function BucketLayout({ bucket, children }: BucketLayoutProps) {
  const classes = useStyles()
  const bucketExistenceData = useBucketExistence(bucket)
  return (
    <Layout
      pre={
        <>
          <M.AppBar position="static" className={classes.appBar}>
            <BucketNav.BucketNav bucket={bucket} />
          </M.AppBar>
          <Container>
            {bucketExistenceData.case({
              Ok: () => children,
              Err: displayError(),
              _: () => <SuspensePlaceholder />,
            })}
          </Container>
        </>
      }
    />
  )
}

export default function Bucket() {
  const location = useLocation()
  const bucket = useBucketStrict()

  const { paths } = NamedRoutes.use<RouteMap>()

  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <BucketLayout bucket={bucket}>
        <AssistantContext.BucketContext bucket={bucket} />
        <CatchNotFound resetKeys={[location.pathname, location.search, location.hash]}>
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
            <Route path={paths.bucketPackageCompare} exact>
              <PackageCompare />
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
