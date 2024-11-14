import * as dateFns from 'date-fns'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Sparkline from 'components/Sparkline'
import * as AWS from 'utils/AWS'
import { useData } from 'utils/Data'
import * as SVG from 'utils/SVG'
import { readableQuantity } from 'utils/string'

import Section from './Section'
import * as requests from './requests'

interface CountsData {
  total: number
  counts: { date: Date; value: number }[]
}

interface AnalyticsProps {
  bucket: string
  path: string
}
export default function Analytics({ bucket, path }: AnalyticsProps) {
  const [cursor, setCursor] = React.useState<number | null>(null)
  const s3 = AWS.S3.use()
  const today = React.useMemo(() => new Date(), [])
  const formatDate = (date: Date) =>
    dateFns.format(
      date,
      today.getFullYear() === date.getFullYear() ? 'd MMM' : 'd MMM yyyy',
    )
  const data = useData(requests.objectAccessCounts, { s3, bucket, path, today })

  const defaultExpanded = data.case({
    Ok: ({ total }: CountsData) => !!total,
    _: () => false,
  })

  return (
    <Section icon="bar_charts" heading="Analytics" defaultExpanded={defaultExpanded}>
      {data.case({
        Ok: ({ counts, total }: CountsData) =>
          total ? (
            <M.Box
              display="flex"
              width="100%"
              justifyContent="space-between"
              alignItems="center"
            >
              <M.Box>
                <M.Typography variant="h5">Downloads</M.Typography>
                <M.Typography variant="h4" component="div">
                  {readableQuantity(cursor === null ? total : counts[cursor].value)}
                </M.Typography>
                <M.Typography variant="overline" component="span">
                  {cursor === null
                    ? `${counts.length} days`
                    : formatDate(counts[cursor].date)}
                </M.Typography>
              </M.Box>
              <M.Box width="calc(100% - 7rem)">
                <Sparkline
                  data={R.pluck('value', counts)}
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
          ) : (
            <M.Typography>No analytics available</M.Typography>
          ),
        Err: () => <M.Typography>No analytics available</M.Typography>,
        _: () => <M.CircularProgress />,
      })}
    </Section>
  )
}
