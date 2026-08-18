import * as React from 'react'
import { Redirect, Route, Switch } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useFeature } from 'utils/features'

import Detail from './Detail'
import List from './List'

const useStyles = M.makeStyles((t) => ({
  content: {
    marginTop: t.spacing(3),
  },
  headerCard: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    marginBottom: t.spacing(2),
  },
  headerTop: {
    padding: t.spacing(2, 3),
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

  // Off means the capability does not exist, not that it is hidden: no route
  // mounts and the URL falls through to the app's NotFound.
  if (!enabled) return <Redirect to={urls.home()} />

  return (
    <Container className={classes.content}>
      <MetaTitle>Data products</MetaTitle>

      <Switch>
        {/* Detail carries its own header and section tabs, so it is not wrapped
            in the list's header card — two stacked titles would compete for the
            same slot. `exact` is deliberately absent: the section routes live
            below this path and Detail's own Switch dispatches them. */}
        <Route path={paths.dataProduct}>
          <M.Paper className={classes.section}>
            <Detail />
          </M.Paper>
        </Route>

        <Route path={paths.dataProducts} exact>
          <M.Paper className={classes.headerCard}>
            <div className={classes.headerTop}>
              <M.Typography variant="h5">Data products</M.Typography>
              {/* Says plainly where products come from. Quilt renders them; it
                  does not define them, and a reader who expects to create one
                  here should learn otherwise before hunting for the button. */}
              <M.Typography variant="body2" color="textSecondary">
                Defined and governed in your enterprise catalog. Quilt shows what they
                hold and who can reach it.
              </M.Typography>
            </div>
          </M.Paper>
          <M.Paper className={classes.section}>
            <List />
          </M.Paper>
        </Route>

        <Route>
          <Redirect to={urls.dataProducts()} />
        </Route>
      </Switch>
    </Container>
  )
}

export default function DataProducts() {
  return <Layout pre={<DataProductsScreen />} />
}
