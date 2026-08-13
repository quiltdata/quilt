import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import { bucketPackageTree } from 'constants/routes'
import * as Format from 'utils/format'

import useRecentlyRevisedPackages from '../useRecentlyRevisedPackages'
import TileCard from './TileCard'

const useStyles = M.makeStyles((t) => ({
  item: {
    alignItems: 'baseline',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 13,
    gap: t.spacing(1),
    padding: t.spacing(0.5, 0),
    textDecoration: 'none',
    '&:hover': {
      color: t.palette.text.primary,
    },
  },
  icon: {
    fontSize: 15,
    opacity: 0.6,
    position: 'relative',
    top: 2,
  },
  body: {
    minWidth: 0,
  },
  name: {
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    fontSize: 11,
    opacity: 0.7,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

export default function RecentPackagesTile() {
  const classes = useStyles()
  const { fetching, error, packages } = useRecentlyRevisedPackages()

  return (
    <TileCard icon="history" title="Recent packages">
      {fetching && (
        <M.Typography color="textSecondary" variant="body2">
          Loading recent revisions…
        </M.Typography>
      )}
      {!fetching && error && (
        <M.Typography color="textSecondary" variant="body2">
          Couldn’t load recent packages
        </M.Typography>
      )}
      {!fetching && !error && !packages.length && (
        <M.Typography color="textSecondary" variant="body2">
          No recent package revisions found
        </M.Typography>
      )}
      {!fetching &&
        !error &&
        packages.map((pkg) => (
          <Link
            key={pkg.id}
            to={bucketPackageTree.url(
              pkg.bucket,
              pkg.name,
              pkg.pointer === 'latest' ? pkg.pointer : pkg.hash,
            )}
            className={classes.item}
          >
            <M.Icon className={classes.icon}>inventory_2</M.Icon>
            <span className={classes.body}>
              <div className={classes.name}>{pkg.name}</div>
              <div className={classes.meta}>
                {pkg.bucket} · <Format.Relative value={pkg.modified} />
              </div>
            </span>
          </Link>
        ))}
    </TileCard>
  )
}
