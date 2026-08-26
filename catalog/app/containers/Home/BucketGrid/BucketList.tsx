import * as React from 'react'
import * as M from '@material-ui/core'

import BucketCard, { Bucket } from './BucketCard'
import DataProductCard from './DataProductCard'
import type { VolumeEntry } from './entries'

export type { Bucket }

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
  // One sorted, paginated list of volumes — buckets and data products
  // interleaved. Not two arrays: a caller that could pass them separately would
  // be able to order them separately, which is the two-panes shape this replaced.
  entries: ReadonlyArray<VolumeEntry>
  tagIsMatching?: (tag: string) => boolean
  onTagClick?: (tag: string) => void
}

export default function BucketList({
  entries,
  tagIsMatching = () => false,
  onTagClick = () => {},
}: BucketListProps) {
  const classes = useGridStyles()
  return (
    <div className={classes.grid}>
      {entries.map((e) =>
        e.kind === 'bucket' ? (
          <BucketCard
            key={`bucket:${e.bucket.name}`}
            bucket={e.bucket}
            tagIsMatching={tagIsMatching}
            onTagClick={onTagClick}
          />
        ) : (
          // Keys are kind-prefixed: a product id and a bucket name occupy the
          // same keyspace once they share a list, and a collision would make
          // React reuse the wrong card.
          <DataProductCard key={`product:${e.product.id}`} product={e.product} />
        ),
      )}
    </div>
  )
}
