import cx from 'classnames'
import * as dateFns from 'date-fns'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import assertNever from 'utils/assertNever'
import type { PackageHandle } from 'utils/packageHandle'
import { readableBytes } from 'utils/string'

import { Revision, RevisionResult } from './useRevision'
import * as Diff from './Diff'

interface ModifiedProps {
  packageHandle: PackageHandle
  revision: Revision
}

function Modified({
  packageHandle: { bucket, name },
  revision: { modified, hash },
}: ModifiedProps) {
  const { urls } = NamedRoutes.use()
  const formatted = React.useMemo(
    () => dateFns.format(modified, 'MMMM do yyyy - h:mma'),
    [modified],
  )
  return (
    <M.Typography variant="body2">
      <StyledLink to={urls.bucketPackageTree(bucket, name, hash)}>{formatted}</StyledLink>
    </M.Typography>
  )
}

function ModifiedSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={120} />
    </M.Typography>
  )
}

const useMessageStyles = M.makeStyles((t) => ({
  empty: {
    color: t.palette.text.secondary,
    fontStyle: 'italic',
  },
}))

interface MessageProps {
  revision: Revision
}

function Message({ revision: { message } }: MessageProps) {
  const classes = useMessageStyles()
  return (
    <M.Typography
      className={cx(!message && classes.empty)}
      variant="body2"
      component="span"
    >
      {message || 'No message'}
    </M.Typography>
  )
}

function MessageSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={240} />
    </M.Typography>
  )
}

interface SizeProps {
  revision: Revision
}

function Size({ revision: { totalBytes } }: SizeProps) {
  return (
    <M.Typography variant="body2" component="span">
      <M.Tooltip title={`${totalBytes} B`}>{readableBytes(totalBytes)}</M.Tooltip>
    </M.Typography>
  )
}

function SizeSkeleton() {
  return (
    <M.Typography variant="body2">
      <Lab.Skeleton width={60} />
    </M.Typography>
  )
}

const useColumnStyles = M.makeStyles((t) => ({
  cell: {
    padding: t.spacing(1, 0),
    whiteSpace: 'nowrap',
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
    },
  },
}))

interface ColumnProps {
  packageHandle: PackageHandle
  revision: Revision
  other?: Revision
  order: Diff.Order
}

function Column({ packageHandle, revision, other, order }: ColumnProps) {
  const classes = useColumnStyles()
  return (
    <div>
      <div className={classes.cell}>
        <Modified packageHandle={packageHandle} revision={revision} />
      </div>
      <div className={classes.cell}>
        {!other || revision.message == other.message ? (
          <Message revision={revision} />
        ) : (
          <Diff.Change order={order}>
            <Message revision={revision} />
          </Diff.Change>
        )}
      </div>
      <div className={classes.cell}>
        {!other || revision.totalBytes === other.totalBytes ? (
          <Size revision={revision} />
        ) : (
          <Diff.Change order={order}>
            <Size revision={revision} />
          </Diff.Change>
        )}
      </div>
    </div>
  )
}

function ColumnSkeleton() {
  const classes = useColumnStyles()
  return (
    <div>
      <div className={classes.cell}>
        <ModifiedSkeleton />
      </div>
      <div className={classes.cell}>
        <MessageSkeleton />
      </div>
      <div className={classes.cell}>
        <SizeSkeleton />
      </div>
    </div>
  )
}

interface ColumnErrorProps {
  error: Error
}

function ColumnError({ error }: ColumnErrorProps) {
  return <Lab.Alert severity="error">{error.message}</Lab.Alert>
}

interface ColumnWrapperProps {
  packageHandle: PackageHandle
  result: RevisionResult
  other: RevisionResult
}

function ColumnWrapper({ packageHandle, result, other }: ColumnWrapperProps) {
  const order: Diff.Order = React.useMemo(() => {
    if (result._tag !== 'ok' || other._tag !== 'ok') return 'limbo' as const
    return result.revision.modified > other.revision.modified ? 'latter' : 'former'
  }, [result, other])

  switch (result._tag) {
    case 'idle':
      return null
    case 'loading':
      return <ColumnSkeleton />
    case 'error':
      return <ColumnError error={result.error} />
    case 'ok':
      return other._tag === 'ok' ? (
        <Column
          packageHandle={packageHandle}
          revision={result.revision}
          other={other.revision}
          order={order}
        />
      ) : (
        <Column packageHandle={packageHandle} revision={result.revision} order={order} />
      )
    default:
      assertNever(result)
  }
}

const useStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridColumnGap: t.spacing(8),
    marginTop: t.spacing(1),
  },
}))

interface SystemMetaTableProps {
  left: PackageHandle
  right: PackageHandle | null
  leftRevision: RevisionResult
  rightRevision: RevisionResult
}

export default function SystemMetaTable({
  left,
  right,
  leftRevision,
  rightRevision,
}: SystemMetaTableProps) {
  const classes = useStyles()

  return (
    <div className={classes.grid}>
      <ColumnWrapper other={rightRevision} packageHandle={left} result={leftRevision} />
      {right && (
        <ColumnWrapper
          other={leftRevision}
          packageHandle={right}
          result={rightRevision}
        />
      )}
    </div>
  )
}
