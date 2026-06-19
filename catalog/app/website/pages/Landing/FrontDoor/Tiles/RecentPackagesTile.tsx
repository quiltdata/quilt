import * as React from 'react'
import * as M from '@material-ui/core'

import useRecentPackages from '../useRecentPackages'
import TileCard from './TileCard'

const useStyles = M.makeStyles((t) => ({
  item: {
    alignItems: 'center',
    color: t.palette.text.secondary,
    display: 'flex',
    fontSize: 13,
    gap: t.spacing(1),
    padding: t.spacing(0.5, 0),
  },
  mono: {
    fontFamily: ['Roboto Mono', 'monospace'].join(','),
    fontSize: 12,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

export default function RecentPackagesTile() {
  const classes = useStyles()
  const recent = useRecentPackages()

  return (
    <TileCard icon="history" title="Recent packages">
      {recent.length ? (
        recent.slice(0, 4).map((pkg, index) => {
          const label = pkg.title || pkg.name || pkg.url || 'Recent package'
          return (
            <M.Link
              key={`${label}-${index}`}
              href={pkg.url}
              color="inherit"
              underline="none"
              className={classes.item}
            >
              <M.Icon style={{ fontSize: 15, opacity: 0.6 }}>inventory_2</M.Icon>
              <span className={classes.mono}>{label}</span>
            </M.Link>
          )
        })
      ) : (
        <M.Typography color="textSecondary" variant="body2">
          Open a package to see it here
        </M.Typography>
      )}
    </TileCard>
  )
}
