import * as React from 'react'
import * as RR from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { NotFoundInTabs } from 'containers/NotFound'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const UsersAndRoles = RT.mkLazy(() => import('./UsersAndRoles'), SuspensePlaceholder)
const Buckets = RT.mkLazy(() => import('./Buckets'), SuspensePlaceholder)
const Settings = RT.mkLazy(() => import('./Settings'), SuspensePlaceholder)
const Status = RT.mkLazy(() => import('./Status'), SuspensePlaceholder)

const AdminErrorFallback = () => (
  <M.Box my={4}>
    <M.Typography variant="h4" align="center" gutterBottom>
      Unexpected Error
    </M.Typography>
    <M.Typography align="center">See the console for details</M.Typography>
  </M.Box>
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
  const location = RR.useLocation()
  const { paths } = NamedRoutes.use()

  const sections = {
    users: { path: paths.adminUsers, exact: true },
    buckets: { path: paths.adminBuckets },
    settings: { path: paths.adminSettings, exact: true },
    status: { path: paths.adminStatus, exact: true },
  }

  const getSection = (pathname: string) => {
    for (const [section, maybeVariants] of Object.entries(sections)) {
      const variants = ([] as RR.RouteProps[]).concat(maybeVariants)
      for (const opts of variants) {
        if (RR.matchPath(pathname, opts)) return section
      }
    }
    return false
  }

  return (
    <AdminLayout section={getSection(location.pathname)}>
      <ErrorBoundary
        FallbackComponent={AdminErrorFallback}
        resetKeys={[location.pathname, location.search, location.hash]}
      >
        <RR.Switch>
          <RR.Route path={paths.adminUsers} exact strict>
            <UsersAndRoles />
          </RR.Route>
          <RR.Route path={paths.adminSettings} exact>
            <Settings />
          </RR.Route>
          <RR.Route path={paths.adminStatus} exact>
            <Status />
          </RR.Route>
          <RR.Route path={paths.adminBuckets}>
            <Buckets />
          </RR.Route>
          <RR.Route>
            <NotFoundInTabs />
          </RR.Route>
        </RR.Switch>
      </ErrorBoundary>
    </AdminLayout>
  )
}
