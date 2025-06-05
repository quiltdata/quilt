import cx from 'classnames'
import jsonpath from 'jsonpath'
import * as React from 'react'
import * as RR from 'react-router-dom'
import * as M from '@material-ui/core'

import * as JSONPointer from 'utils/JSONPointer'
import * as NamedRoutes from 'utils/NamedRoutes'
import assertNever from 'utils/assertNever'
import * as Format from 'utils/format'
import { readableBytes } from 'utils/string'
import type { Json, JsonRecord } from 'utils/types'

import { columnLabels, packageFilterLabels } from '../i18n'
import * as SearchUIModel from '../model'

const NoValue = () => (
  <M.Box display="inline-block" width={16}>
    <M.Divider />
  </M.Box>
)

const isJsonRecord = (obj: Json): obj is JsonRecord =>
  obj != null && typeof obj === 'object' && !Array.isArray(obj)

interface TableViewSystemMetaProps {
  hit: SearchUIModel.SearchHitPackage
  filter: SearchUIModel.FilterStateForResultType<SearchUIModel.ResultType.QuiltPackage>['order'][number]
}

function TableViewSystemMeta({ hit, filter }: TableViewSystemMetaProps) {
  switch (filter) {
    case 'workflow':
      return hit.workflow ? hit.workflow.id : <NoValue />
    case 'size':
      return readableBytes(hit.size)
    case 'modified':
      return <Format.Relative value={hit.modified} />
    default:
      return null
  }
}

interface TableViewUserMetaProps {
  meta: JsonRecord
  pointer: JSONPointer.Pointer
}

function TableViewUserMeta({ meta, pointer }: TableViewUserMetaProps) {
  if (!isJsonRecord(meta))
    return (
      <M.Tooltip title={`${meta}`}>
        <M.Icon color="disabled" fontSize="small" style={{ verticalAlign: 'middle' }}>
          error_outline
        </M.Icon>
      </M.Tooltip>
    )
  const value = jsonpath.value(meta, JSONPointer.toJsonPath(pointer))
  return value || <NoValue />
}

const useTableViewHitStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    position: 'relative',
    '& th:last-child $head::after': {
      display: 'none',
    },
  },
  scrollArea: {
    paddingRight: t.spacing(4),
    overflowX: 'auto',
  },
  cell: {
    whiteSpace: 'nowrap',
  },
  head: {
    display: 'flex',
    alignItems: 'center',
    position: 'relative',
    '&::after': {
      content: '""',
      position: 'absolute',
      right: t.spacing(-3),
      top: t.spacing(1),
      bottom: t.spacing(1),
      background: t.palette.divider,
      width: '1px',
    },
    '&:hover $headActions': {
      opacity: 1,
    },
  },
  headActions: {
    opacity: 0.3,
    transition: t.transitions.create('opacity'),
    marginLeft: t.spacing(2),
  },
}))

interface TableViewPackageProps {
  hit: SearchUIModel.SearchHitPackage
}

function TableViewPackage({ hit }: TableViewPackageProps) {
  const { state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const meta = hit.meta ? JSON.parse(hit.meta) : {}
  const classes = useTableViewHitStyles()
  const { urls } = NamedRoutes.use()
  return (
    <M.TableRow hover>
      <M.TableCell className={classes.cell}>
        <RR.Link to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}>
          {hit.name}
        </RR.Link>
      </M.TableCell>
      {state.filter.order.map((filter) => (
        <M.TableCell
          className={classes.cell}
          data-search-hit-filter={filter}
          key={filter}
        >
          <TableViewSystemMeta hit={hit} filter={filter} />
        </M.TableCell>
      ))}
      {Array.from(state.userMetaFilters.filters.keys()).map((key) => (
        <M.TableCell className={classes.cell} data-search-hit-meta={key} key={key}>
          <TableViewUserMeta meta={meta} pointer={key} />
        </M.TableCell>
      ))}
    </M.TableRow>
  )
}

interface TableViewObjectProps {
  hit: SearchUIModel.SearchHitObject
}

function TableViewObject({ hit }: TableViewObjectProps) {
  return (
    <M.TableRow hover>
      <M.TableCell>{hit.key}</M.TableCell>
    </M.TableRow>
  )
}

interface TableViewHitProps {
  hit: SearchUIModel.SearchHit
}

function TableViewHit({ hit }: TableViewHitProps) {
  switch (hit.__typename) {
    case 'SearchHitObject':
      return <TableViewObject hit={hit} />
    case 'SearchHitPackage':
      return <TableViewPackage hit={hit} />
    default:
      assertNever(hit)
  }
}

const useColumnActionStyles = M.makeStyles((t) => ({
  root: {
    width: t.spacing(4),
    height: t.spacing(4),
  },
  icon: {
    fontSize: '20px',
  },
}))

interface ColumnActionProps {
  className?: string
  icon: string
  onClick?: () => void
}

function ColumnAction({ className, icon, onClick }: ColumnActionProps) {
  const classes = useColumnActionStyles()
  return (
    <M.IconButton className={cx(classes.root, className)} size="small" onClick={onClick}>
      <M.Icon className={classes.icon}>{icon}</M.Icon>
    </M.IconButton>
  )
}

const useColumnActionsStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridAutoFlow: 'column',
    gridColumnGap: t.spacing(1),
  },
}))

interface ColumnActionsProps {
  className: string
  onSearch: () => void
  onSort: () => void
  onClose?: () => void
}

function ColumnActions({ className, onSearch, onSort, onClose }: ColumnActionsProps) {
  const classes = useColumnActionsStyles()
  return (
    <div className={cx(classes.root, className)}>
      <ColumnAction onClick={onSearch} icon="search" />
      <ColumnAction onClick={onSort} icon="sort" />
      {onClose && <ColumnAction onClick={onClose} icon="close" />}
    </div>
  )
}

const useAddColumnStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.default,
    bottom: 0,
    boxShadow: t.shadows[4],
    position: 'absolute',
    right: 0,
    top: 0,
    width: t.spacing(4),
    cursor: 'pointer',
    transition: t.transitions.create('width'),
    '&:hover': {
      width: t.spacing(5),
      boxShadow: t.shadows[1],
    },
    '&:hover $button': {
      opacity: 1,
    },
  },
  head: {
    display: 'flex',
    justifyContent: 'center',
    padding: t.spacing(0.75, 0),
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  button: {
    transition: t.transitions.create('opacity'),
    opacity: 0.3,
  },
}))

interface AddColumnProps {
  onClick: () => void
}

function AddColumn({ onClick }: AddColumnProps) {
  const classes = useAddColumnStyles()
  return (
    <div className={classes.root} onClick={onClick}>
      <div className={classes.head}>
        <ColumnAction className={classes.button} icon="add" />
      </div>
    </div>
  )
}

const noopFixme = () => {}

export interface TableViewProps {
  hits: readonly SearchUIModel.SearchHit[]
}

export default function TableView({ hits }: TableViewProps) {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = useTableViewHitStyles()
  return (
    <M.Paper className={classes.root}>
      <div className={classes.scrollArea}>
        <M.Table size="small">
          <M.TableHead>
            <M.TableRow>
              <M.TableCell className={classes.cell}>
                <div className={classes.head}>
                  Name
                  <ColumnActions
                    className={classes.headActions}
                    onSearch={noopFixme}
                    onSort={noopFixme}
                  />
                </div>
              </M.TableCell>
              {state.filter.order.map((filter) => (
                <M.TableCell key={filter} className={classes.cell}>
                  <div className={classes.head}>
                    <M.Tooltip title={packageFilterLabels[filter]}>
                      <span>{columnLabels[filter]}</span>
                    </M.Tooltip>
                    <ColumnActions
                      className={classes.headActions}
                      onSearch={noopFixme}
                      onSort={noopFixme}
                      onClose={() => actions.deactivatePackagesFilter(filter)}
                    />
                  </div>
                </M.TableCell>
              ))}
              {Array.from(state.userMetaFilters.filters.keys()).map((key) => (
                <M.TableCell key={key} className={classes.cell}>
                  <div className={classes.head}>
                    {key}
                    <ColumnActions
                      className={classes.headActions}
                      onSearch={noopFixme}
                      onSort={noopFixme}
                      onClose={() => actions.deactivatePackagesMetaFilter(key)}
                    />
                  </div>
                </M.TableCell>
              ))}
            </M.TableRow>
          </M.TableHead>
          <M.TableBody>
            {hits.map((hit) => (
              <TableViewHit key={hit.id} hit={hit} />
            ))}
          </M.TableBody>
        </M.Table>
      </div>
      <AddColumn onClick={noopFixme} />
    </M.Paper>
  )
}
