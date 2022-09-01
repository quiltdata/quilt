import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import * as dateFns from 'date-fns'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import * as DG from 'components/DataGrid'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import * as NamedRoutes from 'utils/NamedRoutes'
import useQuery from 'utils/useQuery'

import { useDataGridStyles } from './DataGrid'
import REPORTS_QUERY from './gql/Reports.generated'
import type STATUS_QUERY from './gql/Status.generated'

type StatusResult = NonNullable<ResultOf<typeof STATUS_QUERY>['status']>
type StatusReport = StatusResult['reports']['page'][number]

interface ReportLinkProps {
  loc: Model.S3.S3ObjectLocation
}

function DownloadLink({ loc, ...props }: ReportLinkProps & M.IconButtonProps<'a'>) {
  const url = AWS.Signer.useDownloadUrl(loc, { filename: loc.key })
  return (
    <M.Tooltip title="Download report">
      <M.IconButton component="a" href={url} rel="noreferrer" target="_blank" {...props}>
        <M.Icon>save_alt</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}

function PreviewLink({ loc }: ReportLinkProps) {
  const { urls } = NamedRoutes.use()
  const url = urls.bucketFile(loc.bucket, loc.key, { version: loc.version })
  return (
    <M.Tooltip title="Preview in catalog">
      <M.IconButton component={RRDom.Link} to={url}>
        <M.Icon>visibility</M.Icon>
      </M.IconButton>
    </M.Tooltip>
  )
}

const columns: DG.GridColumns = [
  {
    field: 'timestamp',
    headerName: 'Timestamp (UTC)',
    type: 'dateTime',
    flex: 1,
    renderCell: (params: DG.GridCellParams) => {
      const ts = params.value as Date
      const iso = ts.toISOString()
      const utcStr = `${iso.substring(0, 10)} ${iso.substring(11, 19)}`
      return <>{utcStr}</>
    },
    filterOperators: DG.getGridDateOperators().filter((op) =>
      ['onOrAfter', 'onOrBefore', 'is'].includes(op.value),
    ),
  },
  {
    field: 'renderedReportLocation',
    headerName: 'Actions',
    width: 150,
    disableColumnMenu: true,
    filterable: false,
    sortable: false,
    align: 'right',
    renderCell: (params: DG.GridCellParams) => {
      const loc = params.value as Model.S3.S3ObjectLocation
      return (
        <>
          <PreviewLink loc={loc} />
          <DownloadLink loc={loc} edge="end" />
        </>
      )
    },
  },
]

const sortModelToOrder = (sm: DG.GridSortModel): Model.GQLTypes.StatusReportListOrder =>
  sm[0].sort === 'desc'
    ? Model.GQLTypes.StatusReportListOrder.NEW_FIRST
    : Model.GQLTypes.StatusReportListOrder.OLD_FIRST

const filterModelToFilter = ({
  items: [filterItem],
}: DG.GridFilterModel): Model.GQLTypes.StatusReportListFilter => {
  if (!filterItem?.operatorValue || !filterItem?.value)
    return { timestampFrom: null, timestampTo: null }

  const ts = new Date(filterItem.value)
  const eod = dateFns.add(ts, { days: 1, seconds: -1 })

  switch (filterItem.operatorValue) {
    case 'is':
      return { timestampFrom: ts, timestampTo: eod }
    case 'onOrAfter':
      return { timestampFrom: ts, timestampTo: null }
    case 'onOrBefore':
      return { timestampFrom: null, timestampTo: eod }
    default:
      throw new Error(`Unsupported operator '${filterItem.operatorValue}'`)
  }
}

interface ReportsProps {
  total: number
  firstPage: readonly StatusReport[]
  defaultPerPage: number
  defaultOrder: Model.GQLTypes.StatusReportListOrder
}

export default function Reports({
  total,
  firstPage,
  defaultPerPage,
  defaultOrder,
}: ReportsProps) {
  const classes = useDataGridStyles()

  const defaults = {
    page: 1,
    perPage: defaultPerPage,
    filter: { timestampFrom: null, timestampTo: null },
    order: defaultOrder,
  }

  const { current: fallbacks } = React.useRef({
    rows: firstPage,
    rowCount: total,
  })

  const [sortModel, setSortModel] = React.useState<DG.GridSortModel>(() => [
    {
      field: 'timestamp',
      sort:
        defaults.order === Model.GQLTypes.StatusReportListOrder.NEW_FIRST
          ? 'desc'
          : 'asc',
    },
  ])
  const handleSortModelChange = React.useCallback((params: DG.GridSortModelParams) => {
    setSortModel(params.sortModel)
  }, [])
  const order = React.useMemo(() => sortModelToOrder(sortModel), [sortModel])

  const [filterModel, setFilterModel] = React.useState<DG.GridFilterModel>({ items: [] })
  const handleFilterModelChange = React.useCallback(
    (params: DG.GridFilterModelParams) => {
      setFilterModel(params.filterModel)
    },
    [],
  )
  const filter = React.useMemo(() => filterModelToFilter(filterModel), [filterModel])

  const [page, setPage] = React.useState(defaults.page)
  const handlePageChange = React.useCallback((params: DG.GridPageChangeParams) => {
    setPage(params.page + 1)
  }, [])

  const [pageSize, setPageSize] = React.useState(defaults.perPage)
  const handlePageSizeChange = React.useCallback((params: DG.GridPageChangeParams) => {
    setPageSize(params.pageSize)
    // reset page when changing page size
    setPage(1)
  }, [])

  const variables = {
    page,
    perPage: pageSize,
    filter,
    order,
  }

  const pause = R.equals(defaults, variables)

  const data = useQuery({
    query: REPORTS_QUERY,
    pause,
    variables,
  })

  // console.log('data', data)
  // TODO: handle data.error

  const rows = (
    pause ? firstPage : data.data?.status?.reports.page ?? fallbacks.rows
  ) as StatusReport[]
  if (rows !== fallbacks.rows) fallbacks.rows = rows

  const isFiltered = !R.equals(defaults.filter, variables.filter)

  const rowCount = isFiltered
    ? data.data?.status?.reports.total ?? fallbacks.rowCount
    : total
  if (rowCount !== fallbacks.rowCount) fallbacks.rowCount = rowCount

  const loading = pause ? false : data.fetching

  return (
    <M.Paper className={classes.root}>
      <div className={classes.header}>
        <M.Typography variant="h6">Reports</M.Typography>
      </div>
      <DG.DataGrid
        className={classes.grid}
        rows={rows}
        columns={columns}
        getRowId={(r) => (r as StatusReport).timestamp.toISOString()}
        autoHeight
        disableSelectionOnClick
        disableColumnSelector
        disableColumnResize
        disableColumnReorder
        disableMultipleSelection
        disableMultipleColumnsSorting
        disableMultipleColumnsFiltering
        localeText={{
          columnMenuSortAsc: 'Sort ascending',
          columnMenuSortDesc: 'Sort descending',
          noRowsLabel: 'No reports',
          filterOperatorIs: 'is on',
        }}
        sortingMode="server"
        sortingOrder={['desc', 'asc']}
        sortModel={sortModel}
        onSortModelChange={handleSortModelChange}
        filterMode="server"
        filterModel={filterModel}
        onFilterModelChange={handleFilterModelChange}
        pagination
        paginationMode="server"
        rowCount={rowCount}
        onPageChange={handlePageChange}
        page={page - 1}
        pageSize={pageSize}
        onPageSizeChange={handlePageSizeChange}
        loading={loading}
      />
    </M.Paper>
  )
}
