import * as R from 'ramda'
import * as React from 'react'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as MDG from '@material-ui/data-grid'

import * as Chart from 'components/EChartsChart'
import * as DG from 'components/DataGrid'
import MetaTitle from 'utils/MetaTitle'
import useQuery from 'utils/useQuery'

import STATUS_QUERY from './gql/Status.generated'

const STATS_WINDOW = 30

type StatusResult = ResultOf<typeof STATUS_QUERY>['status']
type Canary = StatusResult['canaries'][number]

interface State {
  rows: {
    allRows: string[]
    idRowsLookup: Record<string, Canary>
  }
}

const countsByStateSelector = (state: State) =>
  state.rows.allRows.reduce(
    (acc, id) => {
      const prop = {
        true: 'passed',
        false: 'failed',
        null: 'running',
      }[`${state.rows.idRowsLookup[id].ok}`]
      return R.evolve({ [prop]: R.inc }, acc)
    },
    { passed: 0, failed: 0, running: 0 },
  )

const useCountsByStateStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    paddingLeft: t.spacing(2),
  },
  item: {
    alignItems: 'center',
    display: 'flex',

    '& + &': {
      marginLeft: t.spacing(2),
    },
  },
  count: {
    marginLeft: t.spacing(1),
  },
}))

function CountsByState() {
  const classes = useCountsByStateStyles()
  const apiRef = React.useContext(MDG.GridApiContext)
  const counts = MDG.useGridSelector(apiRef, countsByStateSelector)

  const renderItem = (count: number, label: string, ok: boolean | null) =>
    !!count && (
      <M.Tooltip arrow title={label}>
        <span className={classes.item}>
          <StateIcon ok={ok} />
          <span className={classes.count}>{count}</span>
        </span>
      </M.Tooltip>
    )

  return (
    <div className={classes.root}>
      {renderItem(counts.failed, 'Failed', false)}
      {renderItem(counts.running, 'Running', null)}
      {renderItem(counts.passed, 'Passed', true)}
    </div>
  )
}

const Footer = React.forwardRef<HTMLDivElement, MDG.GridFooterContainerProps>(
  function Footer(props, ref) {
    const apiRef = React.useContext(MDG.GridApiContext)
    const pagination = MDG.useGridSelector(apiRef, MDG.gridPaginationSelector)

    const PaginationComponent =
      pagination.pageSize != null && apiRef?.current.components.Pagination

    const PaginationElement = PaginationComponent && (
      <PaginationComponent {...apiRef?.current.componentsProps?.pagination} />
    )

    return (
      <MDG.GridFooterContainer ref={ref} {...props}>
        <CountsByState />
        {PaginationElement}
      </MDG.GridFooterContainer>
    )
  },
)

const useStateIconStyles = M.makeStyles((t) => ({
  ok_true: {
    color: t.palette.info.main,
  },
  ok_false: {
    color: t.palette.error.main,
  },
  ok_null: {
    color: t.palette.text.secondary,
  },
}))

function StateIcon({ ok }: { ok: boolean | null }) {
  const classes = useStateIconStyles()
  const icon = { true: 'check', false: 'error', null: 'watch_later' }[`${ok}`]
  return <M.Icon className={classes[`ok_${ok}`]}>{icon}</M.Icon>
}

const columns: DG.GridColumns = [
  {
    field: 'group',
    headerName: 'Group',
    width: 150,
  },
  {
    field: 'title',
    headerName: 'Title',
    flex: 1,
    renderCell: (params: DG.GridCellParams) => {
      const c = params.row as Canary
      const url = `https://${c.region}.console.aws.amazon.com/synthetics/cw?region=${c.region}#canary/detail/${c.name}`
      return (
        <M.Tooltip
          arrow
          title={
            <>
              {!!c.description && (
                <>
                  {c.description}
                  <br />
                  <br />
                </>
              )}
              Click to go to AWS console
            </>
          }
        >
          <M.Link href={url} rel="noreferrer" target="_blank">
            {params.value}
          </M.Link>
        </M.Tooltip>
      )
    },
  },
  {
    field: 'schedule',
    headerName: 'Schedule',
    width: 160,
  },
  {
    field: 'ok',
    headerName: 'State',
    width: 140,
    valueGetter: (params) => {
      const c = params.row as Canary
      if (c.ok) return 'Passed'
      if (c.ok === false) return 'Failed'
      return 'Running'
    },
    renderCell: (params: DG.GridCellParams) => {
      const c = params.row as Canary
      return (
        <>
          <StateIcon ok={c.ok} />
          <M.Box component="span" ml={1}>
            {params.value}
          </M.Box>
        </>
      )
    },
  },
  {
    field: 'lastRun',
    headerName: 'Last Run',
    type: 'dateTime',
    width: 200,
    align: 'right',
    renderCell: (params: DG.GridCellParams) => {
      const c = params.row as Canary
      return <>{c.lastRun?.toLocaleString() || 'N/A'}</>
    },
  },
]

const useCanariesStyles = M.makeStyles((t) => ({
  root: {
    position: 'relative',
    width: '100%',
    zIndex: 1, // to prevent receiveing shadow from footer
  },
  header: {
    borderBottom: `1px solid ${t.palette.divider}`,
    padding: t.spacing(2),
  },
  // TODO: move to components/DataGrid
  '@global': {
    '.MuiDataGridMenu-root': {
      zIndex: t.zIndex.modal + 1, // show menu over modals
    },
  },
  grid: {
    border: 'none',

    '& .MuiDataGrid-cell': {
      outline: 'none !important',
    },
    '& .MuiDataGrid-colCell': {
      '& .MuiDataGrid-colCellTitleContainer': {
        flex: 'none',
      },
      '& .MuiDataGrid-sortIcon': {
        fontSize: 20, // for consistency w/ other icons
      },
      '& .MuiDataGrid-columnSeparator': {
        pointerEvents: 'none',
      },
      // TODO: figure out why it's not working
      '&:last-child': {
        justifyContent: 'flex-end',
        '& .MuiDataGrid-colCellTitleContainer': {
          order: 1,
        },
        '& .MuiDataGrid-colCellTitle': {
          order: 1,
        },
        '& .MuiDataGrid-columnSeparator': {
          display: 'none',
        },
      },
    },
  },
  rowOk_true: {
    background: fade(t.palette.info.light, 0.5),
    '.MuiDataGrid-root &.MuiDataGrid-row:hover': {
      background: t.palette.info.light,
    },
  },
  rowOk_false: {
    background: fade(t.palette.error.light, 0.2),
    '.MuiDataGrid-root &.MuiDataGrid-row:hover': {
      background: fade(t.palette.error.light, 0.3),
    },
  },
  rowOk_null: {},
}))

interface CanariesProps {
  canaries: Canary[]
}

function Canaries({ canaries }: CanariesProps) {
  const classes = useCanariesStyles()
  const canariesSorted = React.useMemo(
    () =>
      R.sortWith(
        [
          R.ascend((c) => ({ true: 2, false: 1, null: 0 }[`${c.ok}`])),
          R.ascend(R.prop('title')),
        ],
        canaries,
      ),
    [canaries],
  )

  return (
    <M.Paper className={classes.root}>
      <div className={classes.header}>
        <M.Typography variant="h6">Canaries</M.Typography>
      </div>
      <DG.DataGrid
        className={classes.grid}
        rows={canariesSorted}
        columns={columns}
        getRowId={(r) => r.name}
        autoHeight
        components={{ Footer }}
        getRowClassName={({ row }) => classes[`rowOk_${row.ok as boolean | null}`]}
        pagination
        disableSelectionOnClick
        disableColumnSelector
        disableColumnResize
        disableColumnReorder
        disableMultipleSelection
        disableMultipleColumnsSorting
        localeText={{
          columnMenuSortAsc: 'Sort ascending',
          columnMenuSortDesc: 'Sort descending',
        }}
      />
    </M.Paper>
  )
}

const CHART_COLORS = [M.colors.red[300], M.colors.lightBlue[300], M.colors.grey[400]]

const useStatsStyles = M.makeStyles({
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
}

function Stats({ latest, stats }: StatsProps) {
  const classes = useStatsStyles()
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
            text: `Operational Statistics for Past ${STATS_WINDOW} Days`,
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

export default function Status() {
  const query = useQuery({
    query: STATUS_QUERY,
    variables: { window: STATS_WINDOW },
    suspend: true,
  })

  return (
    <M.Box my={2}>
      <MetaTitle>{['Status', 'Admin']}</MetaTitle>
      {query.case({
        data: ({ status: s }) =>
          s.canaries.length ? (
            <>
              <Stats latest={s.latestStats} stats={s.stats} />
              <M.Box pt={2} />
              <Canaries canaries={s.canaries as Canary[]} />
            </>
          ) : (
            <M.Box py={2}>
              <M.Typography variant="h4" align="center" gutterBottom>
                No Data
              </M.Typography>
              <M.Typography align="center">
                Status monitoring is not enabled for this stack
              </M.Typography>
            </M.Box>
          ),
        fetching: () => null, // doesn't happen bc of suspense
      })}
    </M.Box>
  )
}
