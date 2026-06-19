import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as routes from 'constants/routes'
import { useRelevantBuckets } from 'utils/Buckets'

import useBucketSort, { BucketSort } from '../useBucketSort'
import useRecentPackages from '../useRecentPackages'
import TileCard from './TileCard'

// Collapsed tile shows a compact preview; expansion reveals the full bounded list.
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
  controls: {
    display: 'flex',
    gap: t.spacing(0.5),
    margin: t.spacing(0.5, 0, 1),
  },
  sortButton: {
    color: t.palette.text.secondary,
    fontSize: 11,
    minWidth: 0,
    padding: t.spacing(0.25, 0.75),
  },
  sortButtonActive: {
    background: 'rgba(255,255,255,.1)',
    color: t.palette.common.white,
  },
  scroll: {
    maxHeight: 320,
    overflowY: 'auto',
  },
  more: {
    color: '#fabdb3',
    cursor: 'pointer',
    display: 'inline-flex',
    fontSize: 12,
    marginTop: t.spacing(0.5),
  },
}))

interface BucketLike {
  name: string
  title?: string
}

const SORTS: { id: BucketSort; label: string }[] = [
  { id: 'relevant', label: 'Relevant' },
  { id: 'recent', label: 'Recent' },
  { id: 'az', label: 'A-Z' },
]

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
  const buckets = useRelevantBuckets()
  const recentPackages = useRecentPackages()
  const [sort, setSort] = useBucketSort()
  const [expanded, setExpanded] = React.useState(false)

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
      <TileCard icon="folder_open" title="Buckets">
        <M.Typography color="textSecondary" variant="body2">
          No buckets yet
        </M.Typography>
      </TileCard>
    )
  }

  const visible = expanded ? sorted : sorted.slice(0, COLLAPSED_LIMIT)
  const hiddenCount = sorted.length - COLLAPSED_LIMIT

  return (
    <TileCard icon="folder_open" title="Buckets">
      {expanded && (
        <div className={classes.controls} role="group" aria-label="Sort buckets">
          {SORTS.map((option) => (
            <M.Button
              key={option.id}
              size="small"
              className={cx(classes.sortButton, {
                [classes.sortButtonActive]: sort === option.id,
              })}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </M.Button>
          ))}
        </div>
      )}
      <div className={expanded ? classes.scroll : undefined}>
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
      {!expanded && hiddenCount > 0 && (
        <M.Link
          component="button"
          type="button"
          color="inherit"
          underline="none"
          className={classes.more}
          onClick={() => setExpanded(true)}
        >
          View all {sorted.length} buckets
        </M.Link>
      )}
      {expanded && (
        <M.Link
          component="button"
          type="button"
          color="inherit"
          underline="none"
          className={classes.more}
          onClick={() => setExpanded(false)}
        >
          Show less
        </M.Link>
      )}
    </TileCard>
  )
}
