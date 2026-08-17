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
  // The list is a run of full-bleed rows, so its own padding would double the
  // row padding; the detail view needs the card padding.
  detailSection: {
    padding: t.spacing(3),
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

      <M.Paper className={classes.headerCard}>
        <div className={classes.headerTop}>
          <M.Typography variant="h5">Data products</M.Typography>
          {/* Says plainly where products come from. Quilt renders them; it does
              not define them, and a reader who expects to create one here should
              learn otherwise before hunting for the button. */}
          <M.Typography variant="body2" color="textSecondary">
            Defined and governed in your enterprise catalog. Quilt shows what they hold
            and who can reach it.
          </M.Typography>
        </div>
      </M.Paper>

      <M.Paper className={classes.section}>
        <Switch>
          <Route path={paths.dataProduct} exact>
            <div className={classes.detailSection}>
              <Detail />
            </div>
          </Route>
          <Route path={paths.dataProducts} exact>
            <List />
          </Route>
          <Route>
            <Redirect to={urls.dataProducts()} />
          </Route>
        </Switch>
      </M.Paper>
    </Container>
  )
}

export default function DataProducts() {
  return <Layout pre={<DataProductsScreen />} />
}
