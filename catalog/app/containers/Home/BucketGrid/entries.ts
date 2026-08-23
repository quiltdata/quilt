import type * as DP from 'model/DataProducts'

import type { Bucket } from './BucketCard'

/**
 * One entry in the volume list.
 *
 * A volume is a bucket or a data product. They share one list, one filter, one
 * sort and one pagination, because a reader is browsing "what is here" — which
 * backing kind an entry has is a property of the entry, not a reason to put it in
 * a separate pane.
 *
 * A discriminated union rather than a common interface: the two genuinely have
 * almost no fields in common (no `iconUrl`, `s3://` address, tags or
 * collaborators on a product; no platform binding or readability on a bucket), so
 * flattening them would mean a wide type of mostly-null fields and every consumer
 * guessing which half applies. `kind` makes the branch explicit and lets
 * TypeScript check that both cases are handled.
 *
 * `label` and `relevance` are normalized up front so the list's comparators do
 * not need to know either shape — see `asEntries` in containers/Home/Buckets.
 */
export type VolumeEntry =
  | {
      kind: 'bucket'
      /** What the list matches on and displays: the bucket's title. */
      label: string
      /** Relevance tiebreak: the s3 name, matching `useRelevantBuckets`. */
      sortKey: string
      relevance: number
      bucket: Bucket
    }
  | {
      kind: 'product'
      /** A product has no title distinct from its name. */
      label: string
      /** Relevance tiebreak: the product's stable id, not its display name. */
      sortKey: string
      /**
       * Always 0. No platform exposes anything relevance-like for a product, and
       * inventing a score would silently decide ranking; 0 places products among
       * buckets of default relevance rather than pinning them to either end.
       */
      relevance: number
      product: DP.DataProduct
    }
