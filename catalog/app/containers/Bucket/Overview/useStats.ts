import * as React from 'react'

import * as APIConnector from 'utils/APIConnector'
import AsyncResult from 'utils/AsyncResult'
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
export function useStats(bucket: string) {
  const s3 = AWS.S3.use()
  const req = APIConnector.use()
  const statsData = useData(requests.bucketStats, { req, s3, bucket })
  const countQuery = GQL.useQuery(STAT_COUNTS_QUERY, { buckets: [bucket] })
  const totalBytes: string | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => readableBytes(v.totalBytes),
          Err: () => '? B',
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  // Per metric: a number when known, `null` when unknown (error / secure search),
  // `undefined` while loading. `count` formats it (loading → skeleton, unknown → '?').
  const objects: number | null | undefined = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => v.totalObjects as number,
          Err: () => null,
          _: () => undefined,
        },
        statsData.result,
      ),
    [statsData.result],
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
