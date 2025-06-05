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
    '&:hover $headButton': {
      opacity: 1,
    },
  },
  headActions: {
    marginLeft: t.spacing(2),
  },
  headButton: {
    width: t.spacing(4),
    height: t.spacing(4),
    opacity: 0.3,
    transition: 'opacity ease 0.3s',
    '& + &': {
      marginLeft: t.spacing(1),
    },
  },
  headIcon: {
    fontSize: '20px',
  },
  placeholder: {
    position: 'relative',
    width: t.spacing(3),
    '&::before': {
      content: '""',
      position: 'absolute',
      left: 0,
      top: t.spacing(1.5),
      bottom: t.spacing(1.5),
      background: t.palette.divider,
      width: '1px',
    },
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
      <M.TableCell className={classes.placeholder} />
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

export interface TableViewProps {
  hits: readonly SearchUIModel.SearchHit[]
}

export default function TableView({ hits }: TableViewProps) {
  const { actions, state } = SearchUIModel.use(SearchUIModel.ResultType.QuiltPackage)
  const classes = useTableViewHitStyles()
  return (
    <M.Table size="small">
      <M.TableHead>
        <M.TableRow>
          <M.TableCell className={classes.cell}>
            <div className={classes.head}>
              Name
              <div className={classes.headActions}>
                <M.IconButton className={classes.headButton} size="small">
                  <M.Icon className={classes.headIcon}>search</M.Icon>
                </M.IconButton>
                <M.IconButton className={classes.headButton} size="small">
                  <M.Icon className={classes.headIcon}>sort</M.Icon>
                </M.IconButton>
              </div>
            </div>
          </M.TableCell>
          {state.filter.order.map((filter) => (
            <M.TableCell key={filter} className={classes.cell}>
              <div className={classes.head}>
                <M.Tooltip title={packageFilterLabels[filter]}>
                  <span>{columnLabels[filter]}</span>
                </M.Tooltip>
                <div className={classes.headActions}>
                  <M.IconButton className={classes.headButton} size="small">
                    <M.Icon className={classes.headIcon}>search</M.Icon>
                  </M.IconButton>
                  <M.IconButton className={classes.headButton} size="small">
                    <M.Icon className={classes.headIcon}>sort</M.Icon>
                  </M.IconButton>
                  <M.IconButton
                    className={classes.headButton}
                    size="small"
                    onClick={() => actions.deactivatePackagesFilter(filter)}
                  >
                    <M.Icon className={classes.headIcon}>close</M.Icon>
                  </M.IconButton>
                </div>
              </div>
            </M.TableCell>
          ))}
          {Array.from(state.userMetaFilters.filters.keys()).map((key) => (
            <M.TableCell key={key} className={classes.cell}>
              <div className={classes.head}>
                {key}
                <div className={classes.headActions}>
                  <M.IconButton className={classes.headButton} size="small">
                    <M.Icon className={classes.headIcon}>search</M.Icon>
                  </M.IconButton>
                  <M.IconButton className={classes.headButton} size="small">
                    <M.Icon className={classes.headIcon}>sort</M.Icon>
                  </M.IconButton>
                  <M.IconButton
                    className={classes.headButton}
                    size="small"
                    onClick={() => actions.deactivatePackagesMetaFilter(key)}
                  >
                    <M.Icon className={classes.headIcon}>close</M.Icon>
                  </M.IconButton>
                </div>
              </div>
            </M.TableCell>
          ))}
          <M.TableCell className={classes.cell}>
            <div className={classes.head}>
              <M.IconButton size="small" className={classes.headButton}>
                {/* make it vertical div, fixed and overlaying with shadow */}
                <M.Icon className={classes.headIcon}>add_circle_outline</M.Icon>
              </M.IconButton>
            </div>
          </M.TableCell>
        </M.TableRow>
      </M.TableHead>
      <M.TableBody>
        {hits.map((hit) => (
          <TableViewHit key={hit.id} hit={hit} />
        ))}
      </M.TableBody>
    </M.Table>
  )
}
