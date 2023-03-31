import * as dateFns from 'date-fns'
import invariant from 'invariant'
import * as R from 'ramda'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
import type * as urql from 'urql'
import type { ResultOf } from '@graphql-typed-document-node/core'
import * as M from '@material-ui/core'

import * as DG from 'components/DataGrid'
import * as Model from 'model'
import * as AWS from 'utils/AWS'
import { useBucketExistence } from 'utils/BucketCache'
import { useQuery } from 'utils/GraphQL'
import * as NamedRoutes from 'utils/NamedRoutes'

import { useDataGridStyles } from './DataGrid'
import REPORTS_QUERY from './gql/Reports.generated'
import type STATUS_QUERY from './gql/Status.generated'

type StatusResult = Extract<
  ResultOf<typeof STATUS_QUERY>['status'],
  { __typename: 'Status' }
>
type StatusReport = StatusResult['reports']['page'][number]

interface ReportLinkProps {
  loc: Model.S3.S3ObjectLocation
}

function ActualDownloadLink({ loc }: ReportLinkProps) {
  const stack = loc.bucket.replace(/-statusreportsbucket-.*$/, '')
  const url = AWS.Signer.useDownloadUrl(loc, {
    filename: `status-${stack}-${loc.key}`,
    contentType: 'text/html',
  })
  return (
    <M.IconButton component="a" href={url} rel="noreferrer" target="_blank" edge="end">
      <M.Icon>save_alt</M.Icon>
    </M.IconButton>
  )
}

function DownloadLink({ loc }: ReportLinkProps) {
  // populate bucket region cache to get working signed urls
  return useBucketExistence(loc.bucket).case({
    Ok: () => (
      <M.Tooltip title="Download report">
        <ActualDownloadLink loc={loc} />
      </M.Tooltip>
    ),
    Err: (e: Error | undefined) => (
      <M.Tooltip title={`Couldn't get download link: ${e?.message || 'unknown error'}`}>
        <M.IconButton edge="end">
          <M.Icon>error_outline</M.Icon>
        </M.IconButton>
      </M.Tooltip>
    ),
    _: () => (
      <M.Tooltip title="Getting download link">
        <M.IconButton edge="end">
          <M.CircularProgress size={24} color="inherit" style={{ padding: '2px' }} />
        </M.IconButton>
      </M.Tooltip>
    ),
  })
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

interface ErrorOverlayProps {
  error: urql.CombinedError
  resetState: () => void
}

function ErrorOverlay({ error, resetState }: ErrorOverlayProps) {
  return (
    <M.Box pt={3} pb={4}>
      <M.Typography variant="h6" align="center" gutterBottom>
        An error occured
      </M.Typography>
      <M.Typography align="center">{error.message}</M.Typography>
      <M.Box pt={3} display="flex" justifyContent="center">
        <M.Button onClick={resetState} variant="contained" color="primary">
          Reset table state
        </M.Button>
      </M.Box>
    </M.Box>
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
          <DownloadLink loc={loc} />
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

  const [page, setPage] = React.useState(defaults.page)
  const handlePageChange = React.useCallback((params: DG.GridPageChangeParams) => {
    setPage(params.page + 1)
  }, [])

  const [pageSize, setPageSize] = React.useState(defaults.perPage)
  const handlePageSizeChange = React.useCallback(
    (params: DG.GridPageChangeParams) => {
      if (pageSize === params.pageSize) return
      setPageSize(params.pageSize)
      // reset page when changing page size
      setPage(1)
    },
    [pageSize],
  )

  const initialSortModel: DG.GridSortModel = React.useMemo(
    () => [
      {
        field: 'timestamp',
        sort:
          defaults.order === Model.GQLTypes.StatusReportListOrder.NEW_FIRST
            ? 'desc'
            : 'asc',
      },
    ],
    [defaults.order],
  )
  const [sortModel, setSortModel] = React.useState<DG.GridSortModel>(initialSortModel)
  const handleSortModelChange = React.useCallback(
    (params: DG.GridSortModelParams) => {
      if (R.equals(sortModel, params.sortModel)) return
      setSortModel(params.sortModel)
      // reset page when changing sort order
      setPage(1)
    },
    [sortModel],
  )
  const order = React.useMemo(() => sortModelToOrder(sortModel), [sortModel])

  const initialFilterModel: DG.GridFilterModel = React.useMemo(() => ({ items: [] }), [])
  const [filterModel, setFilterModel] =
    React.useState<DG.GridFilterModel>(initialFilterModel)
  const handleFilterModelChange = React.useCallback(
    (params: DG.GridFilterModelParams) => {
      if (R.equals(filterModel, params.filterModel)) return
      setFilterModel(params.filterModel)
      // reset page when changing filtering
      setPage(1)
    },
    [filterModel],
  )
  const filter = React.useMemo(() => filterModelToFilter(filterModel), [filterModel])

  const resetState = React.useCallback(() => {
    setPage(1)
    setPageSize(defaultPerPage)
    setFilterModel(initialFilterModel)
    setSortModel(initialSortModel)
  }, [defaultPerPage, initialFilterModel, initialSortModel])

  const variables = {
    page,
    perPage: pageSize,
    filter,
    order,
  }

  const pause = R.equals(defaults, variables)

  const queryResult = useQuery(REPORTS_QUERY, variables, { pause })

  invariant(queryResult.data?.status?.__typename !== 'Unavailable', 'Status unavailable')

  const rows = (
    pause ? firstPage : queryResult.data?.status?.reports.page ?? fallbacks.rows
  ) as StatusReport[]
  if (rows !== fallbacks.rows) fallbacks.rows = rows

  const isFiltered = !R.equals(defaults.filter, variables.filter)

  const rowCount = isFiltered
    ? queryResult.data?.status?.reports.total ?? fallbacks.rowCount
    : total
  if (rowCount !== fallbacks.rowCount) fallbacks.rowCount = rowCount

  const loading = pause ? false : queryResult.fetching
  const error =
    !pause && !loading && queryResult.error ? { error: queryResult.error } : null

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
        components={{ ErrorOverlay }}
        componentsProps={{ errorOverlay: { resetState } }}
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
        error={error}
      />
    </M.Paper>
  )
}
