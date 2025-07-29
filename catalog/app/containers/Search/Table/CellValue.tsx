import { join } from 'path'

import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { RouteMap } from 'containers/Bucket/Routes'
import PreviewValue from 'components/JsonEditor/PreviewValue'
import * as Format from 'utils/format'
import * as JSONPointer from 'utils/JSONPointer'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { readableBytes } from 'utils/string'

import { ColumnTag } from './useColumns'
import type { Column, FilterType } from './useColumns'
import type { Hit } from './useResults'

const useNoValueStyles = M.makeStyles((t) => ({
  root: {
    display: 'inline-block',
    width: t.spacing(2),
    verticalAlign: 'middle',
  },
}))

function NoValue() {
  const classes = useNoValueStyles()
  return (
    <div className={classes.root}>
      <M.Divider />
    </div>
  )
}

const useMatchStyles = M.makeStyles((t) => ({
  root: {
    background: M.fade(t.palette.warning.light, 0.7),
    padding: t.spacing(0, 0.5),
    margin: t.spacing(0, -0.5),
  },
}))

interface MatchProps extends React.HTMLProps<HTMLSpanElement> {
  on: boolean
}

export const Match = React.forwardRef<HTMLSpanElement, MatchProps>(function Match(
  { className, children, on, ...rest },
  ref,
) {
  const classes = useMatchStyles()
  return (
    <span className={cx(on && classes.root, className)} {...rest} ref={ref}>
      {children}
    </span>
  )
})

const useUserMetaValueStyles = M.makeStyles((t) => ({
  root: {
    verticalAlign: 'middle',
  },
  number: {
    fontFamily: t.typography.monospace.fontFamily,
  },
}))

interface UserMetaValueProps {
  hit: Hit
  pointer: JSONPointer.Pointer
}

function UserMetaValue({ hit, pointer }: UserMetaValueProps) {
  const classes = useUserMetaValueStyles()
  const value = React.useMemo(() => {
    if (hit.meta instanceof Error || !hit.meta) return hit.meta
    try {
      return JSONPointer.getValue(hit.meta || {}, pointer)
    } catch (err) {
      return err instanceof Error ? err : new Error(`${err}`)
    }
  }, [hit.meta, pointer])

  if (value instanceof Error) {
    return (
      <M.Tooltip arrow title={value.message}>
        <M.Icon className={classes.root} color="disabled" fontSize="small">
          error_outline
        </M.Icon>
      </M.Tooltip>
    )
  }

  return (
    <M.Tooltip
      placement="bottom-start"
      title={typeof value === 'string' && value.length > 50 ? value : ''}
    >
      <span className={cx(typeof value === 'number' && classes.number)}>
        <PreviewValue value={value} fallback={<NoValue />} strQuot="" />
      </span>
    </M.Tooltip>
  )
}

interface SystemMetaValueProps {
  hit: Hit
  filter: FilterType | 'bucket'
}

function SystemMetaValue({ hit, filter }: SystemMetaValueProps) {
  const { urls } = NamedRoutes.use<RouteMap>()
  switch (filter) {
    case 'workflow':
      return hit.workflow ? (
        <Match on={hit.matchLocations.workflow}>{hit.workflow.id}</Match>
      ) : (
        <NoValue />
      )
    case 'hash':
      return (
        <StyledLink to={urls.bucketFile(hit.bucket, join('.quilt/packages', hit.hash))}>
          {hit.hash}
        </StyledLink>
      )
    case 'size':
      return readableBytes(hit.size)
    case 'name':
      return (
        <StyledLink to={urls.bucketPackageTree(hit.bucket, hit.name, hit.hash)}>
          <Match on={hit.matchLocations.name}>{hit.name}</Match>
        </StyledLink>
      )
    case 'comment':
      return hit.comment ? (
        <M.Tooltip arrow title={hit.comment} placement="bottom-start">
          <Match on={hit.matchLocations.comment}>{hit.comment}</Match>
        </M.Tooltip>
      ) : (
        <NoValue />
      )
    case 'modified':
      return <Format.Relative value={hit.modified} />
    case 'entries':
      return hit.totalEntriesCount
    case 'bucket':
      return <StyledLink to={urls.bucketPackageList(hit.bucket)}>{hit.bucket}</StyledLink>
    default:
      assertNever(filter)
  }
}

interface CellValueProps {
  column: Column
  hit: Hit
}

export default function CellValue({ column, hit }: CellValueProps) {
  switch (column.tag) {
    case ColumnTag.Bucket:
    case ColumnTag.SystemMeta:
      return <SystemMetaValue hit={hit} filter={column.filter} />
    case ColumnTag.UserMeta:
      return <UserMetaValue hit={hit} pointer={column.filter} />
    default:
      assertNever(column)
  }
}
