import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

import PanelBoundary from '../../PanelBoundary'

import Header from './Header'
import Summaries from './Summaries'
import TabulatorTables from './TabulatorTables'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    // `minmax(0, 1fr)` keeps the single column bounded to the available width so a
    // wide child (e.g. an expanded Tabulator preview table) scrolls within its own
    // overflow container instead of stretching the column and overflowing the page.
    gridTemplateColumns: 'minmax(0, 1fr)',
    gap: t.spacing(2),
    padding: t.spacing(2, 0),
  },
}))

// Reserves each panel's silhouette while its data is in flight, so the column
// doesn't change height when the panel resolves.
function PanelPlaceholder({ height }: { height: number }) {
  return <Skeleton aria-hidden borderRadius={4} height={height} width="100%" />
}

export default function Overview() {
  const classes = useStyles()
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  // One boundary per panel: each reads its own data, so one failing read should
  // cost its own panel and nothing else. Header and Summaries both read
  // BUCKET_QUERY via `useQueryS`, which *throws* on error and *suspends* while
  // loading -- so each needs both boundaries, since an ErrorBoundary does not
  // catch suspension. Without these, a bucket whose GraphQL doesn't answer
  // replaced the entire catalog with the app-level error screen.
  //
  // TabulatorTables folds its own error into a message and never throws, so it
  // needs no boundary here; it is left as-is.
  return (
    <div className={classes.root}>
      <PanelBoundary
        title="Bucket overview unavailable"
        suspenseFallback={<PanelPlaceholder height={320} />}
      >
        <Header bucket={bucket} />
      </PanelBoundary>
      <TabulatorTables bucket={bucket} />
      <PanelBoundary
        title="Summaries unavailable"
        suspenseFallback={<PanelPlaceholder height={160} />}
      >
        <Summaries bucket={bucket} />
      </PanelBoundary>
    </div>
  )
}
