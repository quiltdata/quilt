import * as React from 'react'
import * as RR from 'react-router-dom'
import * as RRDomCompat from 'react-router-dom-v5-compat'
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

function NavTab(props: M.TabProps & RR.LinkProps) {
  const classes = useTabStyles()
  return <M.Tab classes={classes} component={RR.Link} {...props} />
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
  const location = RRDomCompat.useLocation()
  const { paths } = NamedRoutes.use()

  // FIXME: fix section highlighting on load
  const section = React.useMemo(() => {
    const sections = [
      { section: 'users', path: paths.adminUsers, end: true },
      { section: 'buckets', path: paths.adminBuckets, end: true },
      { section: 'sync', path: paths.adminSync, end: true },
      { section: 'settings', path: paths.adminSettings, end: true },
      { section: 'status', path: paths.adminStatus, end: true },
    ]
    const found = sections.find(({ path }) =>
      RRDomCompat.matchPath(path, location.pathname),
    )
    return found?.section
  }, [location.pathname, paths])

  // FIXME: route paths constants
  return (
    <AdminLayout section={section} key={section}>
      <ErrorBoundary key={JSON.stringify(location)}>
        <RRDomCompat.Routes>
          <RRDomCompat.Route path={'/'} element={<UsersAndRoles />} />
          <RRDomCompat.Route path={'buckets'} element={<Buckets />} />
          {cfg.desktop && <RRDomCompat.Route path={'sync'} element={<Sync />} />}
          <RRDomCompat.Route path={'settings'} element={<Settings />} />
          <RRDomCompat.Route path={'status'} element={<Status />} />
          <RRDomCompat.Route element={<ThrowNotFound />} />
        </RRDomCompat.Routes>
      </ErrorBoundary>
    </AdminLayout>
  )
}
