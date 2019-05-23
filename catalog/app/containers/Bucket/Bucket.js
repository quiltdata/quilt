import PT from 'prop-types'
import * as R from 'ramda'
import * as React from 'react'
import { Link, Route, Switch, matchPath } from 'react-router-dom'
import * as RC from 'recompose'
import AppBar from '@material-ui/core/AppBar'
import Tab from '@material-ui/core/Tab'
import Tabs from '@material-ui/core/Tabs'
import { withStyles } from '@material-ui/core/styles'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound } from 'containers/NotFoundPage'
import * as S3 from 'utils/AWS/S3'
import { useCurrentBucketConfig } from 'utils/BucketConfig'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const mkLazy = (load) => RT.loadable(load, { fallback: () => <Placeholder /> })

const Dir = mkLazy(() => import('./Dir'))
const File = mkLazy(() => import('./File'))
const Overview = mkLazy(() => import('./Overview'))
const PackageDetail = mkLazy(() => import('./PackageDetail'))
const PackageList = mkLazy(() => import('./PackageList'))
const PackageTree = mkLazy(() => import('./PackageTree'))
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
  withStyles(({ spacing: { unit } }) => ({
    root: {
      minHeight: 8 * unit,
      minWidth: 120,
    },
  })),
  RC.withProps({ component: Link }),
  Tab,
)

const BucketLayout = RT.composeComponent(
  'Bucket.Layout',
  RC.setPropTypes({
    bucket: PT.string.isRequired,
    section: PT.oneOf([...Object.keys(sections), false]),
  }),
  NamedRoutes.inject(),
  withStyles(({ palette }) => ({
    appBar: {
      backgroundColor: palette.common.white,
      color: palette.getContrastText(palette.common.white),
    },
  })),
  ({ classes, bucket, section = false, children, urls }) => (
    <Layout
      pre={
        <AppBar position="static" className={classes.appBar}>
          <Tabs value={section} centered>
            <NavTab label="Files" value="tree" to={urls.bucketDir(bucket)} />
            <NavTab
              label="Packages"
              value="packages"
              to={urls.bucketPackageList(bucket)}
            />
            <NavTab label="Overview" value="overview" to={urls.bucketOverview(bucket)} />
            {section === 'search' && (
              <NavTab label="Search" value="search" to={urls.bucketSearch(bucket)} />
            )}
          </Tabs>
        </AppBar>
      }
    >
      {children}
    </Layout>
  ),
)

export default ({
  location,
  match: {
    params: { bucket },
  },
}) => {
  const { paths } = NamedRoutes.use()
  const bucketCfg = useCurrentBucketConfig()
  const s3Props = bucketCfg && bucketCfg.region && { region: bucketCfg.region }
  return (
    <S3.Provider {...s3Props}>
      <BucketLayout bucket={bucket} section={getBucketSection(paths)(location.pathname)}>
        <Switch>
          <Route path={paths.bucketFile} component={File} exact strict />
          <Route path={paths.bucketDir} component={Dir} exact />
          <Route path={paths.bucketOverview} component={Overview} exact />
          <Route path={paths.bucketSearch} component={Search} exact />
          <Route path={paths.bucketPackageList} component={PackageList} exact />
          <Route path={paths.bucketPackageDetail} component={PackageDetail} exact />
          <Route path={paths.bucketPackageTree} component={PackageTree} exact />
          <Route component={ThrowNotFound} />
        </Switch>
      </BucketLayout>
    </S3.Provider>
  )
}
