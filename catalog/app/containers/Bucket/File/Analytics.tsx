import * as dateFns from 'date-fns'
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

enum State {
  Loading,
  NoAnalytics,
  Data,
}

interface AnalyticsProps {
  bucket: string
  path: string
}

export default function Analytics({ bucket, path }: AnalyticsProps) {
  const [cursor, setCursor] = React.useState<number | null>(null)

  const result = GQL.useQuery(ACCESS_COUNTS_QUERY, { bucket, key: path })

  const [state, data]:
    | [Exclude<State, State.Data>, null]
    | [State.Data, Model.GQLTypes.AccessCounts] = React.useMemo(() => {
    if (result.fetching) return [State.Loading, null]
    if (result.error) {
      log.error('Error fetching object access counts:', result.error)
      return [State.NoAnalytics, null]
    }
    return result.data?.objectAccessCounts
      ? [State.Data, result.data?.objectAccessCounts]
      : [State.NoAnalytics, null]
  }, [result.fetching, result.error, result.data])

  return (
    <Section icon="bar_charts" heading="Analytics" defaultExpanded={!!data}>
      {(() => {
        switch (state) {
          case State.Loading:
            return <M.CircularProgress />
          case State.NoAnalytics:
            return <M.Typography>No analytics available</M.Typography>
          case State.Data:
            return (
              <M.Box
                display="flex"
                width="100%"
                justifyContent="space-between"
                alignItems="center"
              >
                <M.Box>
                  <M.Typography variant="h5">Downloads</M.Typography>
                  <M.Typography variant="h4" component="div">
                    {readableQuantity(
                      cursor === null ? data.total : data.counts[cursor].value,
                    )}
                  </M.Typography>
                  <M.Typography variant="overline" component="span">
                    {cursor === null
                      ? `${data.counts.length} days`
                      : formatDate(data.counts[cursor].date)}
                  </M.Typography>
                </M.Box>
                <M.Box width="calc(100% - 7rem)">
                  <Sparkline
                    data={data.counts.map((c) => c.value)}
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
      })()}
    </Section>
  )
}
