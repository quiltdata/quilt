import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound } from 'containers/NotFoundPage'
import * as Config from 'utils/Config'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const SuspensePlaceholder = () => <Placeholder color="text.secondary" />

const UsersAndRoles = RT.mkLazy(() => import('./UsersAndRoles'), SuspensePlaceholder)
const Buckets = RT.mkLazy(() => import('./Buckets'), SuspensePlaceholder)
const Sync = RT.mkLazy(() => import('./Sync'), SuspensePlaceholder)
const Settings = RT.mkLazy(() => import('./Settings'), SuspensePlaceholder)

const match = (cases) => (pathname) => {
  // eslint-disable-next-line no-restricted-syntax
  for (const [section, variants] of Object.entries(cases)) {
    // eslint-disable-next-line no-restricted-syntax
    for (const opts of variants) {
      if (RR.matchPath(pathname, opts)) return section
    }
  }
  return false
}

const sections = {
  users: { path: 'adminUsers', exact: true },
  buckets: { path: 'adminBuckets', exact: true },
  sync: { path: 'adminSync', exact: true },
  settings: { path: 'adminSettings', exact: true },
}

const getAdminSection = (paths) =>
  match(
    R.map(
      (variants) => [].concat(variants).map(R.evolve({ path: (p) => paths[p] })),
      sections,
    ),
  )

const useTabStyles = M.makeStyles((t) => ({
  root: {
    minHeight: t.spacing(8),
    minWidth: 120,
  },
}))

function NavTab(props) {
  const classes = useTabStyles()
  return <M.Tab classes={classes} component={RR.Link} {...props} />
}

const useStyles = M.makeStyles((t) => ({
  appBar: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

function AdminLayout({ section = false, children }) {
  const { desktop } = Config.use()
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
              {desktop && <NavTab label="Sync" value="sync" to={urls.adminSync()} />}
              <NavTab label="Settings" value="settings" to={urls.adminSettings()} />
            </M.Tabs>
          </M.AppBar>
          <M.Container maxWidth="lg">{children}</M.Container>
        </>
      }
    />
  )
}

export default function Admin({ location }) {
  const { desktop } = Config.use()
  const { paths } = NamedRoutes.use()
  return (
    <AdminLayout section={getAdminSection(paths)(location.pathname)}>
      <RR.Switch>
        <RR.Route path={paths.adminUsers} component={UsersAndRoles} exact strict />
        <RR.Route path={paths.adminBuckets} component={Buckets} exact />
        {desktop && <RR.Route path={paths.adminSync} component={Sync} exact />}
        <RR.Route path={paths.adminSettings} component={Settings} exact />
        <RR.Route component={ThrowNotFound} />
      </RR.Switch>
    </AdminLayout>
  )
}
