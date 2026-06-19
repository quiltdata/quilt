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
  const totalObjects: string | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => readableQuantity(v.totalObjects),
          Err: () => '?',
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  // Raw object count, kept alongside the formatted `totalObjects` to pluralize its label.
  const numObjects: number | null = React.useMemo(
    () =>
      AsyncResult.case(
        {
          Ok: (v: $TSFixMe) => v.totalObjects,
          _: () => null,
        },
        statsData.result,
      ),
    [statsData.result],
  )
  const pkgCount: string | null = React.useMemo(
    () =>
      GQL.fold(countQuery, {
        data: ({ searchPackages: r }) => {
          switch (r.__typename) {
            case 'EmptySearchResultSet':
              return formatQuantity(0)
            case 'InvalidInput':
            case 'OperationError':
              return '?'
            case 'PackagesSearchResultSet':
              // `-1` == secure search
              return r.total >= 0 ? formatQuantity(r.total) : '?'
            default:
              assertNever(r)
          }
        },
        fetching: () => null,
        error: () => '?',
      }),
    [countQuery],
  )
  // Raw package count, kept alongside the formatted `pkgCount` to pluralize its label.
  const numPackages: number | null = React.useMemo(
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
        fetching: () => null,
        error: () => null,
      }),
    [countQuery],
  )
  return {
    totalBytes,
    totalObjects,
    numObjects,
    pkgCount,
    numPackages,
    statsResult: statsData.result,
  }
}

export type StatsData = ReturnType<typeof useStats>
