import * as React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Layout, { Container } from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useFeature } from 'utils/features'

import Detail from './Detail'

const useStyles = M.makeStyles((t) => ({
  content: {
    marginTop: t.spacing(3),
  },
  notice: {
    marginBottom: t.spacing(2),
  },
  section: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
  },
}))

export function DataProductsScreen() {
  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  // Suspending read (CatalogSettings.use()) — safe inside the root Suspense
  // boundary in app.tsx, same as Queries.
  const enabled = useFeature('data-products')

  // Off means the capability does not exist, not that it is hidden.
  if (!enabled) return <Redirect to={urls.home()} />

  return (
    <Container className={classes.content}>
      <MetaTitle>Data products</MetaTitle>

      {/* Every screen below reads the fixture adapter, so products, members,
          requests and connections are all invented. Say so on the screen: the
          rows are shaped exactly like real ones, and a reader who assumes a
          catalog is connected would take an access request or a connection
          error at face value. Remove this with the fixture adapter. */}
      <Lab.Alert severity="info" className={classes.notice}>
        Example data. No catalog is connected yet, so the products, members, access
        requests and connection states below are illustrative.
      </Lab.Alert>

      <Switch>
        {/* Detail carries its own header and section tabs. `exact` is
            deliberately absent: the section routes live below this path and
            Detail's own Switch dispatches them. */}
        <Route path={paths.dataProduct}>
          <M.Paper className={classes.section}>
            <Detail />
          </M.Paper>
        </Route>

        {/* There is no standalone product list. A data product is a volume, so
            the volume grid is the one place they are browsed — a second list at
            its own URL would be a parallel index of the same objects, and the
            two would drift. The bare path exists only so an old link still
            lands somewhere sensible. */}
        <Route>
          <Redirect to={urls.buckets()} />
        </Route>
      </Switch>
    </Container>
  )
}

export default function DataProducts() {
  return <Layout pre={<DataProductsScreen />} />
}
