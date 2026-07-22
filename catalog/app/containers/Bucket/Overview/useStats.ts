import * as React from 'react'

import * as APIConnector from 'utils/APIConnector'
import * as AsyncResult from 'utils/AsyncResult'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as GQL from 'utils/GraphQL'
import assertNever from 'utils/assertNever'
import { readableBytes, readableQuantity, formatQuantity } from 'utils/string'

import * as requests from '../requests'

import STAT_COUNTS_QUERY from './gql/StatCounts.generated'

// Format a metric for display: loading (`undefined`) → skeleton (`null`),
// unknown (`null`) → '?', otherwise the formatted number.
function count(
  value: number | null | undefined,
  format: (n: number) => React.ReactNode,
): React.ReactNode {
  if (value === undefined) return null
  if (value === null) return '?'
  return format(value)
}

// Bucket size / object / package counts for the Overview header, shared by the
// legacy and v2 headers. The formatted strings drive the stat labels; the raw
// counts pluralize them, and `statsResult` feeds the charts.
// The `Ok` payload shape of `requests.bucketStats` (which is still untyped JS);
// annotate it locally so the migrated `match`/`prevResult` sites are precise.
interface BucketStats {
  totalBytes: number
  totalObjects: number
}

export function useStats(bucket: string) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const statsData = useData(requests.bucketStats, { req, s3, bucket })
  // The result comes back typed as `AsyncResult<unknown>`; narrow the Ok payload.
  const statsResult = statsData.result as AsyncResult.AsyncResult<BucketStats, Error>
  const countQuery = GQL.useQuery(STAT_COUNTS_QUERY, { buckets: [bucket] })
  // `readableBytes` returns `React.ReactNode` (it may render a suffix element),
  // so `totalBytes` is a node, not a bare string — the strict `match` surfaces
  // this (the legacy `any`-typed `.case` masked it). Consumers render it via
  // `<StatsItem value={totalBytes} />`, so a node is exactly right.
  const totalBytes: React.ReactNode = React.useMemo(
    () =>
      AsyncResult.match(
        {
          Ok: (v: BucketStats) => readableBytes(v.totalBytes),
          Err: () => '? B',
          _: () => null,
        },
        statsResult,
      ),
    [statsResult],
  )
  // Per metric: a number when known, `null` when unknown (error / secure search),
  // `undefined` while loading. `count` formats it (loading → skeleton, unknown → '?').
  const objects: number | null | undefined = React.useMemo(
    () =>
      AsyncResult.match(
        {
          Ok: (v: BucketStats) => v.totalObjects,
          Err: () => null,
          _: () => undefined,
        },
        statsResult,
      ),
    [statsResult],
  )
  const packages: number | null | undefined = React.useMemo(
    () =>
      GQL.fold(countQuery, {
        data: ({ searchPackages: r }) => {
          switch (r.__typename) {
            case 'EmptySearchResultSet':
              return 0
            case 'InvalidInput':
            case 'OperationError':
              return null
            case 'PackagesSearchResultSet':
              // `-1` == secure search
              return r.total >= 0 ? r.total : null
            default:
              return assertNever(r)
          }
        },
        fetching: () => undefined,
        error: () => null,
      }),
    [countQuery],
  )
  return {
    totalBytes,
    totalObjects: count(objects, readableQuantity),
    numObjects: objects ?? null,
    pkgCount: count(packages, formatQuantity),
    numPackages: packages ?? null,
    statsResult: statsData.result,
  }
}

export type StatsData = ReturnType<typeof useStats>
