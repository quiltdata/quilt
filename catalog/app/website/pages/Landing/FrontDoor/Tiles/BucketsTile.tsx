import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as routes from 'constants/routes'
import * as NamedRoutes from 'utils/NamedRoutes'
import { useRelevantBuckets } from 'utils/Buckets'

import useBucketSort, { BucketSort } from '../useBucketSort'
import useRecentPackages from '../useRecentPackages'
import TileCard from './TileCard'

// Collapsed tile shows a compact preview; the "View all" link goes to /buckets.
const COLLAPSED_LIMIT = 4

const useStyles = M.makeStyles((t) => ({
  item: {
    alignItems: 'center',
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
  itemName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  more: {
    color: '#fabdb3',
    display: 'inline-flex',
    fontSize: 12,
    marginTop: t.spacing(0.5),
    textDecoration: 'none',
    '&:hover': {
      textDecoration: 'underline',
    },
  },
}))

interface BucketLike {
  name: string
  title?: string
}

function sortBuckets(
  buckets: readonly BucketLike[],
  sort: BucketSort,
  recentOrder: readonly string[],
): BucketLike[] {
  if (sort === 'az') {
    return R.sortBy((b) => (b.title || b.name).toLowerCase(), buckets as BucketLike[])
  }
  if (sort === 'recent') {
    const rank = (name: string) => {
      const idx = recentOrder.indexOf(name)
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
    }
    return R.sortBy((b) => rank(b.name), buckets as BucketLike[])
  }
  // 'relevant' preserves the upstream relevance ordering from useRelevantBuckets.
  return buckets as BucketLike[]
}

export default function BucketsTile() {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const buckets = useRelevantBuckets()
  const recentPackages = useRecentPackages()
  const [sort] = useBucketSort()

  // Derive a recently-visited bucket order from locally-opened packages. This is
  // the only "recent" signal available client-side; buckets without a recent
  // package fall back to relevance order behind the ranked ones.
  const recentOrder = React.useMemo(
    () => R.uniq(recentPackages.map((pkg) => pkg.bucket).filter(Boolean) as string[]),
    [recentPackages],
  )

  const sorted = React.useMemo(
    () => sortBuckets(buckets, sort, recentOrder),
    [buckets, sort, recentOrder],
  )

  if (!buckets.length) {
    return (
      <TileCard icon="folder_open" title="Buckets" href={urls.buckets()}>
        <M.Typography color="textSecondary" variant="body2">
          No buckets yet
        </M.Typography>
      </TileCard>
    )
  }

  const visible = sorted.slice(0, COLLAPSED_LIMIT)
  const hiddenCount = sorted.length - COLLAPSED_LIMIT

  return (
    <TileCard icon="folder_open" title="Buckets" href={urls.buckets()}>
      <div>
        {visible.map((bucket) => (
          <Link
            key={bucket.name}
            to={routes.bucketRoot.url(bucket.name)}
            className={classes.item}
          >
            <M.Icon style={{ fontSize: 15, opacity: 0.6 }}>cloud</M.Icon>
            <span className={classes.itemName}>{bucket.title || bucket.name}</span>
          </Link>
        ))}
      </div>
      {hiddenCount > 0 && (
        <Link to={urls.buckets()} className={classes.more}>
          View all {sorted.length} buckets
        </Link>
      )}
    </TileCard>
  )
}
