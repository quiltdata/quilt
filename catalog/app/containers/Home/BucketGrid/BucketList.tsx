import * as React from 'react'
import * as M from '@material-ui/core'

import BucketCard, { Bucket } from './BucketCard'

export type { Bucket }

// `auto-fill` + `minmax` does the responsive work (no hand-rolled
// breakpoints): 1-up narrow, 2-up mid, 3-up wide. `align-items: start` so
// cards size to their own content instead of stretching to the row's
// tallest — a shorter card leaves whitespace in its grid cell (outside the
// card border), not an internal void inside it.
export const useGridStyles = M.makeStyles((t) => ({
  grid: {
    alignItems: 'start',
    display: 'grid',
    gap: t.spacing(2),
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  },
}))

interface BucketListProps {
  buckets: ReadonlyArray<Bucket>
  tagIsMatching?: (tag: string) => boolean
  onTagClick?: (tag: string) => void
}

export default function BucketList({
  buckets,
  tagIsMatching = () => false,
  onTagClick = () => {},
}: BucketListProps) {
  const classes = useGridStyles()
  return (
    <div className={classes.grid}>
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
