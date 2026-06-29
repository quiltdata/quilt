import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import * as FiltersUI from 'components/Filters'
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
    flexShrink: 0,
    padding: t.spacing(1, 2),
  },
  title: {
    ...t.typography.subtitle1,
    fontWeight: 500,
    marginBottom: t.spacing(1),
  },
  filter: {
    background: t.palette.background.paper,
  },
  bucketList: {
    flexGrow: 1,
    overflowY: 'auto',
  },
  activeHeader: {
    background: t.palette.action.selected,
    paddingLeft: t.spacing(2),
  },
  // Match the icon→label gap of the account menu (NavMenu's ItemContents).
  icon: {
    minWidth: 36,
  },
  // Indent the active bucket's destinations to mark them as nested under the
  // `s3://<bucket>` node.
  nested: {
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
    <M.List className={classes.bucketList} disablePadding dense>
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
              <M.ListItemIcon className={classes.icon}>
                <BucketIcon src={b.iconUrl} title={b.title} />
              </M.ListItemIcon>
              <M.ListItemText primary={`s3://${b.name}`} />
            </M.ListItem>
            {isActive && (
              <div className={classes.nested}>
                <BucketNav.Nav bucket={b.name} />
              </div>
            )}
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
        <div className={classes.title}>Buckets</div>
        <FiltersUI.TinyTextField
          className={classes.filter}
          fullWidth
          placeholder="Filter buckets"
          value={query}
          onChange={setQuery}
        />
      </div>
      <React.Suspense fallback={<M.LinearProgress />}>
        <BucketList query={query} />
      </React.Suspense>
    </div>
  )
}
