import * as React from 'react'
import { Link, Redirect, Route, Switch, matchPath, useLocation } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout, { Container } from 'components/Layout'
import * as DP from 'model/DataProducts'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import Access from './Access'
import Connect from './Connect'
import Definition from './Definition'
import Files from './Files'
import FixtureNotice, { WorkspaceSwitcher } from './FixtureNotice'
import Overview from './Overview'
import Sharing from './Sharing'

/**
 * A product mounted on the bucket route.
 *
 * # Why this is a layout of its own rather than a branch inside `Bucket`
 *
 * Every part of the bucket layout reaches S3 or GraphQL for a *bucket*, and a
 * `volume_id` is not one. Mounting a product through it would issue, on the
 * workspace's own session, against a name that is not a bucket:
 *
 * - `useBucketExistence` — a `headBucket` call;
 * - `BucketPreferences.Provider` — fetches a config object out of the bucket;
 * - `AssistantContext.BucketContext` — describes the bucket to the assistant;
 * - the Overview screens — bucket stats over S3 and GraphQL.
 *
 * Each is the "no privileged path" rule broken in the same way (screen rule R3,
 * C-8): the catalog reads a product through the registry, and its bytes only
 * through a mint and the proxy. It is also unanswerable rather than merely wrong —
 * which session the catalog may present is UNK-C2 — so there is no correct S3 call
 * to make here, and this component makes none.
 *
 * A product's tabs therefore come from **kind and holding**, not from
 * `BucketPreferences`: a product carries no bucket config to read them from.
 *
 * # Why the route param is still `:bucket`
 *
 * `useBucketStrict` and every `useBucketSafe` caller read `:bucket`. A product *is*
 * an S3-compatible bucket at the proxy, so the route is the honest one, and renaming
 * the param would break every existing reader for a cosmetic gain.
 */

const useStyles = M.makeStyles((t) => ({
  content: {
    marginTop: t.spacing(3),
  },
  card: {
    backgroundColor: t.palette.common.white,
    color: t.palette.getContrastText(t.palette.common.white),
    marginBottom: t.spacing(2),
  },
  top: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    padding: t.spacing(2, 3),
  },
  tabs: {
    padding: t.spacing(0, 3),
  },
}))

function NavTab(
  props: React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>,
) {
  return <M.Tab component={Link} {...props} />
}

type Section = 'overview' | 'tree' | 'connect' | 'definition' | 'sharing' | 'access'

/**
 * Which tab is current.
 *
 * Local to the product layout rather than reusing `useBucketSection`, which knows
 * only the bucket sections and would answer `false` for every product tab.
 */
function useSection(id: string): Section | false {
  const location = useLocation()
  const { paths } = NamedRoutes.use()
  return React.useMemo(() => {
    const at = (path: string, exact = true) =>
      !!matchPath(location.pathname, { path, exact })
    if (at(paths.bucketConnect)) return 'connect'
    if (at(paths.bucketDefinition)) return 'definition'
    if (at(paths.bucketSharing)) return 'sharing'
    if (at(paths.bucketAccess)) return 'access'
    if (at(paths.bucketDir) || at(paths.bucketFile)) return 'tree'
    if (at(paths.bucketOverview)) return 'overview'
    return false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, paths, id])
}

export default function ProductVolume({ product }: { product: DP.ProductVolume }) {
  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  const section = useSection(product.id)

  const isOwner = product.holding?.role === 'OWNER'
  const sub = product.holding?.subscription
  const state = sub ? DP.deriveState(sub, 'subscriber') : null
  // Files is offered on a confirmed grant or to the owner. Never on a listing, and
  // never from a decision alone: an approval whose grant is missing would mint and
  // fail (screen rule R4).
  const mayRead = isOwner || (state !== null && DP.grantIsPresent(state))

  return (
    <Layout
      pre={
        <Container className={classes.content}>
          <MetaTitle>{[product.title, 'Data product']}</MetaTitle>
          <M.Paper className={classes.card}>
            <div className={classes.top}>
              <div>
                <M.Typography variant="overline" color="textSecondary" display="block">
                  Data product
                </M.Typography>
                <M.Typography variant="h6">{product.title}</M.Typography>
              </div>
              <WorkspaceSwitcher />
            </div>
            <M.Divider />
            <div className={classes.tabs}>
              {/* Kind- and holding-gated. No Packages, Queries or Workflows: a
                  product has no packages layer, and its virtual tables are a later
                  increment. No Search either — that route scopes global search to an
                  index a product does not have. */}
              <M.Tabs value={section} variant="scrollable" scrollButtons="auto">
                <NavTab
                  label="Overview"
                  value="overview"
                  to={urls.bucketOverview(product.id)}
                />
                {mayRead && (
                  <NavTab label="Files" value="tree" to={urls.bucketDir(product.id)} />
                )}
                <NavTab
                  label="Connect"
                  value="connect"
                  to={urls.bucketConnect(product.id)}
                />
                {isOwner && (
                  <NavTab
                    label="Definition"
                    value="definition"
                    to={urls.bucketDefinition(product.id)}
                  />
                )}
                {isOwner ? (
                  <NavTab
                    label="Sharing"
                    value="sharing"
                    to={urls.bucketSharing(product.id)}
                  />
                ) : (
                  <NavTab
                    label="Access"
                    value="access"
                    to={urls.bucketAccess(product.id)}
                  />
                )}
              </M.Tabs>
            </div>
          </M.Paper>

          <FixtureNotice />

          <M.Paper className={classes.card}>
            <Switch>
              <Route path={paths.bucketConnect} exact>
                <Connect product={product} />
              </Route>
              {/* The owner-only tabs redirect rather than render for anyone else.
                  The API refuses them regardless, and a screen that rendered an
                  empty Sharing would imply the queue was empty rather than absent. */}
              <Route path={paths.bucketDefinition} exact>
                {isOwner ? (
                  <Definition product={product} />
                ) : (
                  <Redirect to={urls.bucketOverview(product.id)} />
                )}
              </Route>
              <Route path={paths.bucketSharing} exact>
                {isOwner ? (
                  <Sharing product={product} />
                ) : (
                  <Redirect to={urls.bucketOverview(product.id)} />
                )}
              </Route>
              <Route path={paths.bucketAccess} exact>
                <Access product={product} />
              </Route>
              <Route path={paths.bucketFile} exact strict>
                <Files product={product} />
              </Route>
              <Route path={paths.bucketDir} exact>
                <Files product={product} />
              </Route>
              <Route path={paths.bucketOverview} exact>
                <Overview product={product} />
              </Route>
              {/* A product has no Packages, Workflows or Queries tab, so any other
                  path under it is not a product screen. Home rather than a 404: the
                  volume exists, the section does not. */}
              <Route>
                <Redirect to={urls.bucketOverview(product.id)} />
              </Route>
            </Switch>
          </M.Paper>
        </Container>
      }
    />
  )
}
