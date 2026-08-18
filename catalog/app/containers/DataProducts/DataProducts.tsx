import * as React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useFeature } from 'utils/features'

import Detail from './Detail'

const useStyles = M.makeStyles((t) => ({
  content: {
    marginTop: t.spacing(3),
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
