import * as React from 'react'
import { Route, Switch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as BucketNav from 'containers/Bucket/Nav'
import { useBucketStrict } from 'containers/Bucket/Routes'
import { NotFoundInTabs } from 'containers/NotFound'
import { useBucketExistence } from 'utils/BucketCache'
import * as CatalogSettings from 'utils/CatalogSettings'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as BucketPreferences from 'utils/BucketPreferences'
import MetaTitle from 'utils/MetaTitle'
import * as RT from 'utils/reactTools'

import * as AssistantContext from './AssistantContext'
import Header from './Header'
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
  // A single container insets the whole bucket page (header card + content) by the
  // standard gutters, so every block shares one source of margins.
  content: {
    paddingBottom: t.spacing(3),
    paddingTop: t.spacing(3),
  },
  // The bucket title/stats row and the tabs live in one elevated card. The white
  // background is set explicitly so it never inherits the dark themed paper color.
  headerCard: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    marginBottom: t.spacing(2),
  },
  headerTop: {
    padding: t.spacing(2, 3),
  },
  tabsRow: {
    padding: t.spacing(0, 3),
  },
}))

interface BucketLayoutProps {
  bucket: string
  children: React.ReactNode
}

function BucketLayout({ bucket, children }: BucketLayoutProps) {
  const classes = useStyles()
  const settings = CatalogSettings.use()
  const bucketExistenceData = useBucketExistence(bucket)
  return (
    <Layout
      pre={
        <Container className={classes.content}>
          <M.Paper className={classes.headerCard}>
            {settings?.beta && (
              <>
                <div className={classes.headerTop}>
                  <Header bucket={bucket} />
                </div>
                <M.Divider />
              </>
            )}
            <div className={classes.tabsRow}>
              <BucketNav.Tabs bucket={bucket} />
            </div>
          </M.Paper>
          {bucketExistenceData.case({
            Ok: () => children,
            Err: displayError(),
            _: () => <SuspensePlaceholder />,
          })}
        </Container>
      }
    />
  )
}

export default function Bucket() {
  const bucket = useBucketStrict()

  const { paths } = NamedRoutes.use<RouteMap>()

  return (
    <BucketPreferences.Provider bucket={bucket}>
      <MetaTitle>{bucket}</MetaTitle>
      <BucketLayout bucket={bucket}>
        <AssistantContext.BucketContext bucket={bucket} />
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
          <Route path={paths.bucketPackageAddFiles} exact>
            <PackageTree />
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
            <NotFoundInTabs />
          </Route>
        </Switch>
      </BucketLayout>
    </BucketPreferences.Provider>
  )
}
