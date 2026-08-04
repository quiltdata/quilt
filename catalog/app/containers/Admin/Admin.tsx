import * as React from 'react'
import * as RR from 'react-router-dom'
import { ErrorBoundary } from 'react-error-boundary'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
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

function NavTab(props: M.TabProps & RR.LinkProps) {
  return <M.Tab component={RR.Link} {...props} />
}

const useStyles = M.makeStyles((t) => ({
  // Horizontal inset comes from `.main`; only vertical spacing here.
  content: {
    marginTop: t.spacing(3),
  },
  tabsCard: {
    // Explicit white so it never inherits the dark themed paper color.
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    marginBottom: t.spacing(2),
    padding: t.spacing(0, 3),
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
        <Container className={classes.content}>
          <M.Paper className={classes.tabsCard}>
            <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
              <NavTab label="Users and roles" value="users" to={urls.adminUsers()} />
              <NavTab label="Buckets" value="buckets" to={urls.adminBuckets()} />
              <NavTab label="Status" value="status" to={urls.adminStatus()} />
              <NavTab label="Settings" value="settings" to={urls.adminSettings()} />
            </M.Tabs>
          </M.Paper>
          {children}
        </Container>
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
