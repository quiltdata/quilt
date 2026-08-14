import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import PreviewValue from 'components/JsonEditor/PreviewValue'
import * as Format from 'utils/format'
import * as JSONPointer from 'utils/JSONPointer'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import { readableBytes } from 'utils/string'

import { useBucketLinks } from './links'
import type { PackageLinkBuilder } from './links'
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

const useOverflowTextTooltipStyles = M.makeStyles((t) => ({
  arrow: {
    // `left` is set by inline styles, so we need `!important`
    left: `${t.spacing(2)}px !important`,
  },
}))

function OverflowTextTooltip({ title, children, ...props }: M.TooltipProps) {
  const classes = useOverflowTextTooltipStyles()
  return (
    <M.Tooltip arrow classes={classes} placement="bottom-start" title={title} {...props}>
      {children}
    </M.Tooltip>
  )
}

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
    if (hit.meta instanceof Error) return hit.meta
    if (!hit.meta) return undefined
    return JSONPointer.getValue(hit.meta, pointer)
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
    <OverflowTextTooltip
      title={typeof value === 'string' && value.length > 50 ? value : ''}
    >
      <span className={cx(typeof value === 'number' && classes.number)}>
        <PreviewValue value={value} fallback={<NoValue />} strQuot="" />
      </span>
    </OverflowTextTooltip>
  )
}

interface SystemMetaValueProps {
  hit: Hit
  filter: FilterType | 'bucket'
  displayName?: string
  links: PackageLinkBuilder
}

function SystemMetaValue({ hit, filter, displayName, links }: SystemMetaValueProps) {
  switch (filter) {
    case 'workflow':
      return hit.workflow ? (
        <Match on={hit.matchLocations.workflow}>{hit.workflow.id}</Match>
      ) : (
        <NoValue />
      )
    case 'hash':
      return (
        <StyledLink
          to={links.manifest({ bucket: hit.bucket, name: hit.name, hash: hit.hash })}
        >
          {hit.hash}
        </StyledLink>
      )
    case 'size':
      return <>{readableBytes(hit.size)}</>
    case 'name':
      return (
        <StyledLink
          to={links.packageRoot(
            { bucket: hit.bucket, name: hit.name, hash: hit.hash },
            hit.pointer,
          )}
        >
          <Match on={hit.matchLocations.name}>{displayName ?? hit.name}</Match>
        </StyledLink>
      )
    case 'comment':
      return hit.comment ? (
        <OverflowTextTooltip title={hit.comment}>
          <Match on={hit.matchLocations.comment}>{hit.comment}</Match>
        </OverflowTextTooltip>
      ) : (
        <NoValue />
      )
    case 'modified':
      return <Format.Relative value={hit.modified} />
    case 'entries':
      return <>{hit.totalEntriesCount}</>
    case 'bucket':
      return <StyledLink to={links.bucket(hit.bucket)}>{hit.bucket}</StyledLink>
    default:
      assertNever(filter)
  }
}

interface CellValueProps {
  column: Column
  hit: Hit
  displayName?: string
  links?: PackageLinkBuilder
}

export default function CellValue({ column, hit, displayName, links }: CellValueProps) {
  const bucketLinks = useBucketLinks()
  switch (column.tag) {
    case ColumnTag.Bucket:
    case ColumnTag.SystemMeta:
      return (
        <SystemMetaValue
          hit={hit}
          filter={column.filter}
          displayName={displayName}
          // INVARIANT: DP call sites (containers/DataProduct PackagesTab) MUST
          // pass `links`; omitting it falls back to /b/<bucket>/ routes,
          // breaking the DP no-/b/ invariant (guarded by a DP regression test).
          links={links ?? bucketLinks}
        />
      )
    case ColumnTag.UserMeta:
      return <UserMetaValue hit={hit} pointer={column.filter} />
    default:
      assertNever(column)
  }
}
