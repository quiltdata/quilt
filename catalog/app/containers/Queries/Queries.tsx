import * as React from 'react'
import { Link, Redirect, Route, Switch, matchPath, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import Athena from './Athena'
import ElasticSearch from './ElasticSearch'

const useStyles = M.makeStyles((t) => ({
  // Spaces the header card away from the search bar above it, mirroring the
  // bucket pages.
  content: {
    marginTop: t.spacing(3),
  },
  // The title and the subsection tabs live in one elevated white card, the
  // workspace-global analogue of the bucket header card.
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
  // The active tab's content (Athena form/editor, ES editor) lives in its own
  // elevated white card so the header above doesn't read as an orphaned float —
  // same padding idiom as the bucket screen's section cards.
  section: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    padding: t.spacing(3),
  },
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  return <M.Tab component={Link} {...props} />
}

// The tail of the current route selects the active subsection tab; anything
// that isn't the ElasticSearch console is some Athena screen.
function useSection(): 'athena' | 'es' {
  const { paths } = NamedRoutes.use()
  const { pathname } = useLocation()
  return matchPath(pathname, { path: paths.queriesEs, exact: true }) ? 'es' : 'athena'
}

function QueriesScreen() {
  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  const section = useSection()
  return (
    <Container className={classes.content}>
      <MetaTitle>Queries</MetaTitle>

      <M.Paper className={classes.headerCard}>
        <div className={classes.headerTop}>
          <M.Typography variant="h5">Queries</M.Typography>
        </div>
        <M.Divider />
        <div className={classes.tabsRow}>
          <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
            <NavTab label="Athena" value="athena" to={urls.queriesAthena()} />
            <NavTab label="ElasticSearch" value="es" to={urls.queriesEs()} />
          </M.Tabs>
        </div>
      </M.Paper>

      <M.Paper className={classes.section}>
        <Switch>
          <Route path={paths.queriesEs} exact>
            <ElasticSearch />
          </Route>
          <Route path={paths.queriesAthena} exact>
            <Athena />
          </Route>
          <Route path={paths.queriesAthenaWorkgroup} exact>
            <Athena />
          </Route>
          <Route path={paths.queriesAthenaExecution} exact>
            <Athena />
          </Route>
          <Route>
            <Redirect to={urls.queriesAthena()} />
          </Route>
        </Switch>
      </M.Paper>
    </Container>
  )
}

export default function Queries() {
  return <Layout pre={<QueriesScreen />} />
}
