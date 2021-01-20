import * as R from 'ramda'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import { ThrowNotFound } from 'containers/NotFoundPage'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as RT from 'utils/reactTools'

const mkLazy = (load) =>
  RT.loadable(load, { fallback: () => <Placeholder color="text.secondary" /> })

const UsersAndRoles = mkLazy(() => import('./UsersAndRoles'))
const Buckets = mkLazy(() => import('./Buckets'))

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
            </M.Tabs>
          </M.AppBar>
          <M.Container maxWidth="lg">{children}</M.Container>
        </>
      }
    />
  )
}

export default function Admin({ location }) {
  const { paths } = NamedRoutes.use()
  return (
    <AdminLayout section={getAdminSection(paths)(location.pathname)}>
      <RR.Switch>
        <RR.Route path={paths.adminUsers} component={UsersAndRoles} exact strict />
        <RR.Route path={paths.adminBuckets} component={Buckets} exact />
        <RR.Route component={ThrowNotFound} />
      </RR.Switch>
    </AdminLayout>
  )
}
