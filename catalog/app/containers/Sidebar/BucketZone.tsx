import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as BucketNav from 'containers/Bucket/Nav'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

export function filterBuckets<T extends { name: string; title: string }>(
  buckets: T[],
  query: string,
): T[] {
  if (!query) return buckets
  const q = query.toLowerCase()
  return buckets.filter(
    (b) => b.name.toLowerCase().includes(q) || b.title.toLowerCase().includes(q),
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    minHeight: 0,
    overflow: 'auto',
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: t.spacing(1),
    padding: t.spacing(1, 2),
  },
  label: {
    flexGrow: 1,
    fontWeight: t.typography.fontWeightMedium,
  },
  filter: {
    width: t.spacing(15),
  },
  bucketList: {
    flexGrow: 1,
    overflowY: 'auto',
  },
  activeHeader: {
    background: t.palette.action.selected,
    paddingLeft: t.spacing(2),
  },
}))

interface BucketListProps {
  query: string
}

function BucketList({ query }: BucketListProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  const buckets = Buckets.useRelevantBuckets()
  const currentBucket = Buckets.useCurrentBucket()
  const filtered = filterBuckets(buckets, query)

  return (
    <M.List className={classes.bucketList} disablePadding>
      {filtered.map((b) => {
        const isActive = !!currentBucket && b.name === currentBucket
        return (
          <React.Fragment key={b.name}>
            <M.ListItem
              button
              component={isActive ? 'div' : Link}
              to={isActive ? undefined : urls.bucketOverview(b.name)}
              className={isActive ? classes.activeHeader : undefined}
              selected={isActive}
            >
              <M.ListItemText primary={`s3://${b.name}`} />
            </M.ListItem>
            {isActive && <BucketNav.Nav bucket={b.name} />}
          </React.Fragment>
        )
      })}
    </M.List>
  )
}

export function BucketZone() {
  const classes = useStyles()
  const [query, setQuery] = React.useState('')

  return (
    <div className={classes.root}>
      <div className={classes.header}>
        <span className={classes.label}>Buckets</span>
        <M.TextField
          className={classes.filter}
          size="small"
          placeholder="Filter"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            endAdornment: query ? <M.Icon fontSize="small">clear</M.Icon> : undefined,
          }}
        />
      </div>
      <React.Suspense fallback={<M.LinearProgress />}>
        <BucketList query={query} />
      </React.Suspense>
    </div>
  )
}
