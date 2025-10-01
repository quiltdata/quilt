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
    <M.Typography className={cx(!message && classes.empty)} variant="body2">
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
  return <M.Typography variant="body2">{readableBytes(totalBytes)}</M.Typography>
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
    padding: t.spacing(2, 0),
    whiteSpace: 'nowrap',
    '& + &': {
      borderTop: `1px solid ${t.palette.divider}`,
    },
  },
}))

interface ColumnProps {
  packageHandle: PackageHandle
  revision: Revision
}

function Column({ packageHandle, revision }: ColumnProps) {
  const classes = useColumnStyles()
  return (
    <div>
      <div className={classes.cell}>
        <Modified packageHandle={packageHandle} revision={revision} />
      </div>
      <div className={classes.cell}>
        <Message revision={revision} />
      </div>
      <div className={classes.cell}>
        <Size revision={revision} />
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
}

function ColumnWrapper({ packageHandle, result }: ColumnWrapperProps) {
  switch (result._tag) {
    case 'idle':
      return null
    case 'loading':
      return <ColumnSkeleton />
    case 'error':
      return <ColumnError error={result.error} />
    case 'ok':
      return <Column packageHandle={packageHandle} revision={result.revision} />
    default:
      assertNever(result)
  }
}

const useStyles = M.makeStyles((t) => ({
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gridColumnGap: t.spacing(4),
    marginTop: t.spacing(1),
  },
}))

interface SystemMetaTableProps {
  left: PackageHandle
  right: PackageHandle
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
      <ColumnWrapper packageHandle={left} result={leftRevision} />
      <ColumnWrapper packageHandle={right} result={rightRevision} />
    </div>
  )
}
