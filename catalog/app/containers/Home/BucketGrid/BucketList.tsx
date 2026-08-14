import * as React from 'react'
import * as M from '@material-ui/core'

import BucketCard, { Bucket } from './BucketCard'
import DataProductCard, { DataProductItem } from './DataProductCard'

export type { Bucket }
export type { DataProductItem }

// `auto-fill` + `minmax` does the responsive work (no hand-rolled
// breakpoints): 1-up narrow, 2-up mid, 3-up wide. `align-items: stretch` so
// every card in a row shares the row's height and the wall reads as tidy
// bands; each card's body grows to absorb the slack above its bottom row.
export const useGridStyles = M.makeStyles((t) => ({
  grid: {
    alignItems: 'stretch',
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  },
}))

interface BucketListProps {
  buckets: ReadonlyArray<Bucket>
  // Data products lead the grid: the sort options key off bucket-only fields
  // (title, relevanceScore), so there is no defensible interleaving. See
  // `Buckets.jsx` for the ordering decision.
  dataProducts?: ReadonlyArray<DataProductItem>
  tagIsMatching?: (tag: string) => boolean
  onTagClick?: (tag: string) => void
}

export default function BucketList({
  buckets,
  dataProducts = [],
  tagIsMatching = () => false,
  onTagClick = () => {},
}: BucketListProps) {
  const classes = useGridStyles()
  return (
    <div className={classes.grid}>
      {dataProducts.map((dp) => (
        <DataProductCard key={dp.id} dp={dp} />
      ))}
      {buckets.map((b) => (
        <BucketCard
          key={b.name}
          bucket={b}
          tagIsMatching={tagIsMatching}
          onTagClick={onTagClick}
        />
      ))}
    </div>
  )
}
