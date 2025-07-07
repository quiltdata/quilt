import * as React from 'react'
import { Route, Switch, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { useBucketStrict } from 'containers/Bucket/Routes'
import { ThrowNotFound } from 'containers/NotFoundPage'
import * as SearchUIModel from 'containers/Search/model'
import { useBucketExistence } from 'utils/BucketCache'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as RT from 'utils/reactTools'

import BucketNav from './BucketNav'
import type { Section } from './BucketNav'
import CatchNotFound from './CatchNotFound'
import type { RouteMap } from './Routes'
import * as Selection from './Selection'
import { displayError } from './errors'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const Dir = RT.mkLazy(() => import('./Dir'), SuspensePlaceholder)
const File = RT.mkLazy(() => import('./File'), SuspensePlaceholder)
const Overview = RT.mkLazy(() => import('./Overview'), SuspensePlaceholder)
const PackageList = RT.mkLazy(() => import('./Search'), SuspensePlaceholder)
const PackageRevisions = RT.mkLazy(
  () => import('./PackageRevisions'),
  SuspensePlaceholder,
)
const PackageTree = RT.mkLazy(() => import('./PackageTree'), SuspensePlaceholder)
const Queries = RT.mkLazy(() => import('./Queries'), SuspensePlaceholder)
const Workflows = RT.mkLazy(() => import('./Workflows'), SuspensePlaceholder)

function useSearchUIModel() {
  return React.useContext(SearchUIModel.Context)
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

interface BucketLayoutProps {
  bucket: string
  section: Section | false
  render: React.FC
}

function BucketLayout({ bucket, section = false, render }: BucketLayoutProps) {
  const classes = useStyles()
  const bucketExistenceData = useBucketExistence(bucket)
  const searchUIModel = useSearchUIModel()
  return (
    <Layout
      pre={
        <>
          <M.AppBar position="static" className={classes.appBar}>
            <BucketNav bucket={bucket} section={section} />
          </M.AppBar>
          <M.Container
            maxWidth={
              searchUIModel && searchUIModel.state.view === SearchUIModel.View.Table
                ? false
                : 'lg'
            }
          >
            {bucketExistenceData.case({
              Ok: render,
              Err: displayError(),
              _: SuspensePlaceholder,
            })}
          </M.Container>
        </>
      }
    />
  )
}

export default function Bucket() {
  const location = useLocation()
  const bucket = useBucketStrict()

  const { paths, urls } = NamedRoutes.use<RouteMap>()

  const urlState: SearchUIModel.SearchUrlState = React.useMemo(
    () => ({
      resultType: SearchUIModel.ResultType.QuiltPackage,
      filter: SearchUIModel.PackagesSearchFilterIO.fromURLSearchParams(
        new URLSearchParams(),
      ),
      userMetaFilters: SearchUIModel.UserMetaFilters.fromURLSearchParams(
        new URLSearchParams(),
        SearchUIModel.META_PREFIX,
      ),
      searchString: '',
      buckets: [bucket],
      order: SearchUIModel.ResultOrder.NEWEST,
      view: SearchUIModel.View.Table,
      latestOnly: true,
    }),
    [bucket],
  )

  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <CatchNotFound id={`${location.pathname}${location.search}${location.hash}`}>
        <Switch>
          <Route path={paths.bucketFile} exact strict>
            <BucketLayout render={File} bucket={bucket} section="tree" />
          </Route>
          <Route path={paths.bucketDir} exact>
            <Selection.Provider>
              <BucketLayout render={Dir} bucket={bucket} section="tree" />
            </Selection.Provider>
          </Route>
          <Route path={paths.bucketOverview} exact>
            <BucketLayout render={Overview} bucket={bucket} section="overview" />
          </Route>
          <Route path={paths.bucketPackageList} exact>
            <SearchUIModel.Provider
              base={urls.bucketPackageList(bucket)}
              urlState={urlState}
            >
              <BucketLayout render={PackageList} bucket={bucket} section="packages" />
            </SearchUIModel.Provider>
          </Route>
          <Route path={paths.bucketPackageDetail} exact>
            <BucketLayout render={PackageTree} bucket={bucket} section="packages" />
          </Route>
          <Route path={paths.bucketPackageTree} exact>
            <BucketLayout render={PackageTree} bucket={bucket} section="packages" />
          </Route>
          <Route path={paths.bucketPackageRevisions} exact>
            <BucketLayout render={PackageRevisions} bucket={bucket} section="packages" />
          </Route>
          <Route path={paths.bucketWorkflowList} exact>
            <BucketLayout render={Workflows} bucket={bucket} section="workflows" />
          </Route>
          <Route path={paths.bucketWorkflowDetail} exact>
            <BucketLayout render={Workflows} bucket={bucket} section="workflows" />
          </Route>
          <Route path={paths.bucketQueries}>
            <BucketLayout render={Queries} bucket={bucket} section="queries" />
          </Route>
          <Route>
            <ThrowNotFound />
          </Route>
        </Switch>
      </CatchNotFound>
    </BucketPreferences.Provider>
  )
}
