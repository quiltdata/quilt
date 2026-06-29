import * as React from 'react'
import { Link } from 'react-router-dom'
import * as M from '@material-ui/core'

import BucketIcon from 'components/BucketIcon'
import * as FiltersUI from 'components/Filters'
import * as BucketNav from 'containers/Bucket/Nav'
import * as Buckets from 'utils/Buckets'
import * as NamedRoutes from 'utils/NamedRoutes'

import { SectionHeader } from './SectionHeader'

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
  },
  filterRow: {
    flexShrink: 0,
    padding: t.spacing(0, 2, 1),
  },
  filter: {
    background: t.palette.background.paper,
  },
  // The active bucket is pinned above the scrolling list so its context (and
  // expanded destinations) stays visible no matter how far the list scrolls.
  activeBlock: {
    flexShrink: 0,
  },
  bucketList: {
    flex: '1 1 0',
    minHeight: 0,
    overflowY: 'auto',
  },
  activeHeader: {
    background: t.palette.action.selected,
    paddingLeft: t.spacing(2),
  },
  // Match the icon→label gap of the account menu (NavMenu's ItemContents), and
  // render the bucket icon at 24px like the other list icons.
  icon: {
    minWidth: 36,
    '& svg, & img': {
      height: t.spacing(3),
      width: t.spacing(3),
    },
  },
  // Indent the active bucket's destinations to mark them as nested under the
  // `s3://<bucket>` node.
  nested: {
    paddingLeft: t.spacing(2),
  },
}))

interface BucketRowProps {
  bucket: { name: string; title: string; iconUrl: string | null }
}

function BucketRow({ bucket }: BucketRowProps) {
  const classes = useStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.ListItem button component={Link} to={urls.bucketOverview(bucket.name)}>
      <M.ListItemIcon className={classes.icon}>
        <BucketIcon src={bucket.iconUrl} title={bucket.title} />
      </M.ListItemIcon>
      <M.ListItemText primary={`s3://${bucket.name}`} />
    </M.ListItem>
  )
}

interface BucketsBodyProps {
  query: string
}

function BucketsBody({ query }: BucketsBodyProps) {
  const classes = useStyles()
  const buckets = Buckets.useRelevantBuckets()
  const currentBucket = Buckets.useCurrentBucket()

  // The active bucket is shown even if it's not in the relevant list (e.g. a
  // bucket reached directly), so fall back to a minimal entry.
  const active = React.useMemo(() => {
    if (!currentBucket) return null
    return (
      buckets.find((b) => b.name === currentBucket) ?? {
        name: currentBucket,
        title: currentBucket,
        iconUrl: null,
      }
    )
  }, [buckets, currentBucket])

  const others = React.useMemo(
    () =>
      filterBuckets(
        buckets.filter((b) => b.name !== currentBucket),
        query,
      ),
    [buckets, currentBucket, query],
  )

  return (
    <>
      {active && (
        <div className={classes.activeBlock}>
          <M.List disablePadding dense>
            <M.ListItem className={classes.activeHeader} selected>
              <M.ListItemIcon className={classes.icon}>
                <BucketIcon src={active.iconUrl} title={active.title} />
              </M.ListItemIcon>
              <M.ListItemText primary={`s3://${active.name}`} />
            </M.ListItem>
            <div className={classes.nested}>
              <BucketNav.Nav bucket={active.name} />
            </div>
          </M.List>
        </div>
      )}
      {active && !!others.length && <M.Divider />}
      <M.List className={classes.bucketList} disablePadding dense>
        {others.map((b) => (
          <BucketRow key={b.name} bucket={b} />
        ))}
      </M.List>
    </>
  )
}

export function BucketZone() {
  const classes = useStyles()
  const [query, setQuery] = React.useState('')
  const [expanded, setExpanded] = React.useState(true)
  const toggle = React.useCallback(() => setExpanded((e) => !e), [])

  return (
    <div className={classes.root}>
      <SectionHeader title="Buckets" expanded={expanded} onToggle={toggle} />
      {expanded && (
        <>
          <div className={classes.filterRow}>
            <FiltersUI.TinyTextField
              className={classes.filter}
              fullWidth
              placeholder="Filter buckets"
              value={query}
              onChange={setQuery}
            />
          </div>
          <React.Suspense fallback={<M.LinearProgress />}>
            <BucketsBody query={query} />
          </React.Suspense>
        </>
      )}
    </div>
  )
}
