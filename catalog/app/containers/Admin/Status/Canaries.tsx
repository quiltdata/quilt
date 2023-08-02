import * as R from 'ramda'
import * as React from 'react'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'
import { fade } from '@material-ui/core/styles'
import * as MDG from '@material-ui/data-grid'

import * as DG from 'components/DataGrid'

import { useDataGridStyles } from './DataGrid'
import type STATUS_QUERY from './gql/Status.generated'

type StatusResult = Extract<
  ResultOf<typeof STATUS_QUERY>['status'],
  { __typename: 'Status' }
>
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
      const url = `https://${c.region}.console.aws.amazon.com/cloudwatch/home?region=${c.region}#synthetics:canary/detail/${c.name}`
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

const useStyles = M.makeStyles((t) => ({
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
  canaries: readonly Canary[]
}

export default function Canaries({ canaries }: CanariesProps) {
  const rowClasses = useStyles()
  const classes = useDataGridStyles()

  const canariesSorted = React.useMemo(
    () =>
      R.sortWith(
        [
          R.ascend((c) => ({ true: 2, false: 1, null: 0 })[`${c.ok}`]),
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
        getRowClassName={({ row }) => rowClasses[`rowOk_${row.ok as boolean | null}`]}
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
