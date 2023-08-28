import * as React from 'react'
import { Link, LinkProps, Outlet, matchPath, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import cfg from 'constants/config'
import { createBoundary } from 'utils/ErrorBoundary'
import * as NamedRoutes from 'utils/NamedRoutes'

const ErrorBoundary = createBoundary(
  () => () => (
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

// NOTE: `ref` types are incompatible
function NavTab(props: Omit<M.TabProps, 'ref'> & LinkProps) {
  const classes = useTabStyles()
  return <M.Tab classes={classes} component={Link} {...props} />
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

function Admin() {
  const location = useLocation()
  const { paths } = NamedRoutes.use()

  const section = React.useMemo(() => {
    const parent = paths.admin.replace('*', '')
    const sections = {
      users: parent + paths.adminUsers,
      buckets: parent + paths.adminBuckets,
      sync: parent + paths.adminSync,
      settings: parent + paths.adminSettings,
      status: parent + paths.adminStatus,
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const found = Object.entries(sections).find(([_0, pattern]) =>
      matchPath(pattern, location.pathname),
    )
    return found?.[0]
  }, [location.pathname, paths])

  return (
    <AdminLayout section={section}>
      <ErrorBoundary key={JSON.stringify(location)}>
        <Outlet />
      </ErrorBoundary>
    </AdminLayout>
  )
}

export const Component: React.FC = Admin
