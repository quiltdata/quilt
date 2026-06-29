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
            <BucketList query={query} />
          </React.Suspense>
        </>
      )}
    </div>
  )
}
