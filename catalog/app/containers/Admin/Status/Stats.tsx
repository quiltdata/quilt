import * as React from 'react'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import * as Chart from 'components/EChartsChart'

import type STATUS_QUERY from './gql/Status.generated'

type StatusResult = Extract<
  ResultOf<typeof STATUS_QUERY>['status'],
  { __typename: 'Status' }
>

const CHART_COLORS = [M.colors.red[300], M.colors.lightBlue[300], M.colors.grey[400]]

const useStyles = M.makeStyles({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  donut: {
    height: '300px',
    width: '300px',
  },
  history: {
    flex: 1,
    height: '300px',
    minWidth: '350px',
    width: 'calc(100% - 300px)',
  },
})

interface StatsProps {
  latest: StatusResult['latestStats']
  stats: StatusResult['stats']
  statsWindow: number
}

export default function Stats({ latest, stats, statsWindow }: StatsProps) {
  const classes = useStyles()
  const t = M.useTheme()
  const titleTextProps = {
    textStyle: {
      fontFamily: t.typography.h6.fontFamily,
      fontSize: t.typography.h6.fontSize,
      fontWeight: t.typography.h6.fontWeight,
    },
    left: 'center',
    top: 16,
  }
  const total = latest.passed + latest.failed

  const handleInit: Chart.InitHook = (chart) => {
    // highlight passed tests data by default
    const passedIndex = 1
    const hlDefault = () =>
      chart.dispatchAction({ type: 'highlight', dataIndex: passedIndex })

    hlDefault()

    chart.on('mouseover', (e) => {
      if (e.dataIndex === passedIndex) return
      chart.dispatchAction({ type: 'downplay', dataIndex: passedIndex })
    })

    chart.on('mouseout', hlDefault)

    return () => {
      chart.off('mouseover')
      chart.off('mouseout')
    }
  }

  return (
    <M.Paper className={classes.root}>
      <Chart.Chart
        className={classes.donut}
        onInit={handleInit}
        option={{
          // @ts-expect-error
          title: {
            text: 'Current Operational Status',
            ...titleTextProps,
          },
          color: CHART_COLORS,
          series: [
            {
              type: 'pie',
              radius: ['30%', '60%'],
              label: {
                formatter: `{main|{b}}\n{sub|{c}/${total} tests}`,
                show: false,
                position: 'center',
                fontFamily: t.typography.subtitle1.fontFamily,
                rich: {
                  main: {
                    fontSize: t.typography.subtitle1.fontSize,
                    // @ts-expect-error
                    fontWeight: t.typography.subtitle1.fontWeight,
                    lineHeight: 24,
                  },
                  sub: {
                    fontSize: t.typography.subtitle2.fontSize,
                    // @ts-expect-error
                    fontWeight: t.typography.subtitle2.fontWeight,
                    lineHeight: 16,
                  },
                },
              },
              emphasis: {
                label: {
                  show: true,
                },
              },
              data: [
                { value: latest.failed, name: 'Failed' },
                { value: latest.passed, name: 'Passed' },
                { value: latest.running, name: 'Running' },
              ],
            },
          ],
        }}
      />
      <Chart.Chart
        className={classes.history}
        resize
        option={{
          // @ts-expect-error
          title: {
            text: `Operational Statistics for Past ${statsWindow} Days`,
            ...titleTextProps,
          },
          color: CHART_COLORS,
          tooltip: { trigger: 'axis' },
          xAxis: [
            {
              data: stats.datetimes.map((d) =>
                d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
              ),
            },
          ],
          yAxis: [{ type: 'value' }],
          series: [
            {
              type: 'line',
              name: 'Failed',
              stack: 'Total',
              areaStyle: {},
              data: stats.failed as number[],
            },
            {
              type: 'line',
              name: 'Passed',
              stack: 'Total',
              areaStyle: {},
              data: stats.passed as number[],
            },
          ],
        }}
      />
    </M.Paper>
  )
}
