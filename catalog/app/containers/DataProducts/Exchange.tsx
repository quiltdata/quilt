import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as DP from 'model/DataProducts'
import * as NamedRoutes from 'utils/NamedRoutes'

import FixtureNotice, { StateLine, WorkspaceSwitcher } from './FixtureNotice'

/**
 * The exchange listing: what is published in my workspace's scope.
 *
 * The discovery surface — "what may I ask for?". Nothing here proves readability: a
 * listing is visibility, and the relation column says what this workspace's
 * standing is, not what it may read (invariant 1). So there are no counts, no
 * "readable" marks, and no entry sizes.
 *
 * A product the workspace already holds stays in the list, with its relation shown.
 * Filtering held products out would make the listing answer a different question
 * than the one it is for.
 */

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(3),
  },
  filters: {
    display: 'flex',
    gap: t.spacing(1),
    margin: t.spacing(2, 0),
  },
  row: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2, 0),
  },
  title: {
    textDecoration: 'none',
  },
}))

type Filter = 'all' | 'held' | 'available'

export default function Exchange() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const workspace = DP.useActiveWorkspace()
  const listing = DP.useExchange()
  const [filter, setFilter] = React.useState<Filter>('all')

  const shown = React.useMemo(
    () =>
      listing.filter((p) => {
        if (filter === 'held') return p.holding !== null
        if (filter === 'available') return p.holding === null
        return true
      }),
    [listing, filter],
  )

  return (
    <div className={classes.root} data-testid="dp-exchange">
      <M.Box display="flex" justifyContent="space-between" alignItems="center">
        <div>
          <M.Typography variant="h5">Exchange</M.Typography>
          <M.Typography variant="body2" color="textSecondary">
            Data products published in this stack, as workspace {workspace} sees them.
          </M.Typography>
        </div>
        <WorkspaceSwitcher />
      </M.Box>

      <M.Box mt={2}>
        <FixtureNotice />
      </M.Box>

      <div className={classes.filters}>
        {(['all', 'held', 'available'] as Filter[]).map((f) => (
          <M.Chip
            key={f}
            label={f === 'held' ? 'Mine' : f === 'available' ? 'Available' : 'All'}
            variant={filter === f ? 'default' : 'outlined'}
            onClick={() => setFilter(f)}
          />
        ))}
      </div>

      {shown.length === 0 ? (
        <M.Typography variant="body2" color="textSecondary">
          {listing.length === 0
            ? 'No data products are published in this stack yet.'
            : 'No products match this filter.'}
        </M.Typography>
      ) : (
        shown.map((p) => {
          const holdingCopy = DP.holdingSummary(p.holding)
          return (
            <div key={p.id} className={classes.row} data-testid="dp-exchange-row">
              <M.Typography variant="subtitle1">
                <Link className={classes.title} to={urls.bucketRoot(p.id)}>
                  {p.title}
                </Link>
              </M.Typography>
              <M.Typography variant="caption" color="textSecondary" display="block">
                {p.id} · published by {p.owner.name}
                {p.published &&
                  ` · since ${p.published.publishedAt.toLocaleDateString()}`}
              </M.Typography>
              {p.description && (
                <M.Typography variant="body2" color="textSecondary">
                  {p.description}
                </M.Typography>
              )}
              {p.definition.referencedBuckets.length > 0 && (
                <M.Typography variant="caption" color="textSecondary" display="block">
                  {/* The shape of the set without its bytes. */}
                  selects from{' '}
                  {p.definition.referencedBuckets.map((b) => `s3://${b}`).join(', ')}
                </M.Typography>
              )}
              <M.Box mt={1}>
                {holdingCopy ? (
                  <StateLine copy={holdingCopy} />
                ) : (
                  <M.Button
                    size="small"
                    variant="outlined"
                    component={Link}
                    to={urls.bucketAccess(p.id)}
                  >
                    Request access
                  </M.Button>
                )}
              </M.Box>
            </div>
          )
        })
      )}
    </div>
  )
}
