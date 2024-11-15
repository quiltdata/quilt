import * as dateFns from 'date-fns'
import * as Eff from 'effect'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'
import Sparkline from 'components/Sparkline'
import * as GQL from 'utils/GraphQL'
import log from 'utils/Logging'
import * as SVG from 'utils/SVG'
import { readableQuantity } from 'utils/string'

import Section from '../Section'

import ACCESS_COUNTS_QUERY from './gql/ObjectAccessCounts.generated'

const currentYear = new Date().getFullYear()

const formatDate = (date: Date) =>
  dateFns.format(date, currentYear === date.getFullYear() ? 'd MMM' : 'd MMM yyyy')

interface AnalyticsProps {
  accessCounts: Model.GQLTypes.AccessCounts
}

function Analytics({ accessCounts }: AnalyticsProps) {
  const [cursor, setCursor] = React.useState<number | null>(null)

  const { total, counts } = accessCounts

  return (
    <M.Box display="flex" width="100%" justifyContent="space-between" alignItems="center">
      <M.Box>
        <M.Typography variant="h5">Downloads</M.Typography>
        <M.Typography variant="h4" component="div">
          {readableQuantity(cursor === null ? total : counts[cursor].value)}
        </M.Typography>
        <M.Typography variant="overline" component="span">
          {cursor === null ? `${counts.length} days` : formatDate(counts[cursor].date)}
        </M.Typography>
      </M.Box>
      <M.Box width="calc(100% - 7rem)">
        <Sparkline
          data={counts.map((c) => c.value)}
          onCursor={setCursor}
          width={1000}
          height={60}
          stroke={SVG.Paint.Server(
            <linearGradient x2="0" y2="100%" gradientUnits="userSpaceOnUse">
              <stop offset="0" stopColor={M.colors.blueGrey[800]} />
              <stop offset="100%" stopColor={M.colors.blueGrey[100]} />
            </linearGradient>,
          )}
        />
      </M.Box>
    </M.Box>
  )
}

interface AnalyticsContainerProps {
  bucket: string
  path: string
}

export default function AnalyticsContainer({ bucket, path }: AnalyticsContainerProps) {
  const result = GQL.useQuery(ACCESS_COUNTS_QUERY, { bucket, key: path })

  const data = React.useMemo(() => {
    if (result.fetching) return Eff.Option.none()
    if (result.error) log.error('Error fetching object access counts:', result.error)
    return Eff.Option.some(Eff.Option.fromNullable(result.data?.objectAccessCounts))
  }, [result.fetching, result.error, result.data])

  const defaultExpanded = Eff.Option.match(data, {
    onNone: () => false,
    onSome: Eff.Option.match({
      onNone: () => false,
      onSome: ({ total }) => !!total,
    }),
  })

  return (
    <Section icon="bar_charts" heading="Analytics" defaultExpanded={defaultExpanded}>
      {Eff.Option.match(data, {
        onNone: () => <M.CircularProgress />,
        onSome: Eff.Option.match({
          onNone: () => <M.Typography>No analytics available</M.Typography>,
          onSome: (accessCounts) =>
            accessCounts.total ? (
              <Analytics accessCounts={accessCounts} />
            ) : (
              <M.Typography>No analytics available</M.Typography>
            ),
        }),
      })}
    </Section>
  )
}
