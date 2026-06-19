import * as React from 'react'
import * as M from '@material-ui/core'

import * as routes from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'

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
}))

export default function BucketsTile() {
  const classes = useStyles()
  const buckets = useRelevantBuckets()

  return (
    <TileCard icon="folder_open" title="Buckets">
      {buckets.length ? (
        buckets.slice(0, 4).map((bucket) => (
          <M.Link
            key={bucket.name}
            href={routes.bucketRoot.url(bucket.name)}
            color="inherit"
            underline="none"
            className={classes.item}
          >
            <M.Icon style={{ fontSize: 15, opacity: 0.6 }}>cloud</M.Icon>
            <span>{bucket.name}</span>
          </M.Link>
        ))
      ) : (
        <M.Typography color="textSecondary" variant="body2">
          No buckets yet
        </M.Typography>
      )}
    </TileCard>
  )
}
