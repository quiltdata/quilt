import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import cfg from 'constants/config'
import { ThrowNotFound } from 'containers/NotFoundPage'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const UsersAndRoles = RT.mkLazy(() => import('./UsersAndRoles'), SuspensePlaceholder)
const Buckets = RT.mkLazy(() => import('./Buckets'), SuspensePlaceholder)
const Sync = RT.mkLazy(() => import('./Sync'), SuspensePlaceholder)
const Settings = RT.mkLazy(() => import('./Settings'), SuspensePlaceholder)
const Status = RT.mkLazy(() => import('./Status'), SuspensePlaceholder)

const ErrorBoundary = createBoundary(
  () => () =>
    (
      <M.Box my={4}>
        <M.Typography variant="h4" align="center" gutterBottom>
          Unexpected Error
        </M.Typography>
        <M.Typography align="center">See the console for details</M.Typography>
      </M.Box>
    ),
  'AdminErrorBoundary',
)

const useTabStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(8),
    minWidth: 120,
  },
}))

function NavTab(props: M.TabProps & RRDom.LinkProps) {
  const classes = useTabStyles()
  return <M.Tab classes={classes} component={RRDom.Link} {...props} />
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

type AdminLayoutProps = React.PropsWithChildren<{
  section?: string | false
}>

function AdminLayout({ section = false, children }: AdminLayoutProps) {
  const { urls } = NamedRoutes.use()
  const classes = useStyles()
  return (
    <Layout
      pre={
        <>
          <M.AppBar position="static" className={classes.appBar}>
            <M.Tabs value={section} centered>
              <NavTab label="Users and roles" value="users" to={urls.adminUsers()} />
              <NavTab label="Buckets" value="buckets" to={urls.adminBuckets()} />
              {cfg.desktop && <NavTab label="Sync" value="sync" to={urls.adminSync()} />}
              <NavTab label="Status" value="status" to={urls.adminStatus()} />
              <NavTab label="Settings" value="settings" to={urls.adminSettings()} />
            </M.Tabs>
          </M.AppBar>
          <M.Container maxWidth="lg">{children as React.ReactChild}</M.Container>
        </>
      }
    />
  )
}

export default function Admin() {
  const location = RRDom.useLocation()
  const { paths } = NamedRoutes.use()

  const sections = {
    users: { path: paths.adminUsers, exact: true },
    buckets: { path: paths.adminBuckets, exact: true },
    sync: { path: paths.adminSync, exact: true },
    settings: { path: paths.adminSettings, exact: true },
    status: { path: paths.adminStatus, exact: true },
  }

  const getSection = (pathname: string) => {
    for (const [section, maybeVariants] of Object.entries(sections)) {
      const variants = ([] as RRDom.RouteProps[]).concat(maybeVariants)
      for (const opts of variants) {
        if (RRDom.matchPath(pathname, opts)) return section
      }
    }
    return false
  }

  return (
    <AdminLayout section={getSection(location.pathname)}>
      <ErrorBoundary key={JSON.stringify(location)}>
        <RRDom.Switch>
          <RRDom.Route path={paths.adminUsers} component={UsersAndRoles} exact strict />
          <RRDom.Route path={paths.adminBuckets} component={Buckets} exact />
          {cfg.desktop && <RRDom.Route path={paths.adminSync} component={Sync} exact />}
          <RRDom.Route path={paths.adminSettings} component={Settings} exact />
          <RRDom.Route path={paths.adminStatus} component={Status} exact />
          <RRDom.Route component={ThrowNotFound} />
        </RRDom.Switch>
      </ErrorBoundary>
    </AdminLayout>
  )
}
