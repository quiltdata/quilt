import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'
import * as Icons from '@material-ui/icons'

import assertNever from 'utils/assertNever'
import JsonDisplay from 'components/JsonDisplay'
import * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { readableBytes } from 'utils/string'
import * as s3paths from 'utils/s3paths'

import type { Revision, RevisionResult } from '../useRevision'

import Change from './Change'
import type { Dir, Order } from './Change'
import GridRow from './GridRow'

const useAddedStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
  },
}))

interface AddedProps {
  className: string
  dir: Dir
  logicalKey: string
}

function Added({ className, dir, logicalKey }: AddedProps) {
  const classes = useAddedStyles()
  return (
    <GridRow className={cx(classes.root, className)} divided>
      <Change order={dir === 'forward' ? 'former' : 'latter'}>{logicalKey}</Change>
      <Change order={dir === 'forward' ? 'latter' : 'former'}>{logicalKey}</Change>
    </GridRow>
  )
}

const useUnmodifiedStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

interface UnmodifiedProps {
  className: string
  logicalKey: string
}

function Unmodified({ className, logicalKey }: UnmodifiedProps) {
  const classes = useUnmodifiedStyles()
  return (
    <GridRow className={cx(classes.root, className)}>
      {logicalKey}
      <i>Unmodified</i>
    </GridRow>
  )
}

type Modifications = Record<keyof Model.PackageEntry, boolean>

function getEntryChanges(
  entry: Model.PackageEntry,
  modified: Modifications,
): Partial<Model.PackageEntry> {
  return {
    physicalKey: modified.physicalKey ? entry.physicalKey : undefined,
    hash: modified.hash ? entry.hash : undefined,
    size: modified.size ? entry.size : undefined,
    meta: modified.meta ? entry.meta : undefined,
  }
}

interface ModifiedProps {
  className: string
  logicalKey: string
  dir: Dir
  left: Model.PackageEntry
  right: Model.PackageEntry
  modified: Modifications
}

function Modified({ className, dir, logicalKey, left, right, modified }: ModifiedProps) {
  const changes = React.useMemo(
    () => ({
      left: getEntryChanges(left, modified),
      right: getEntryChanges(right, modified),
    }),
    [left, right, modified],
  )
  return (
    <GridRow className={className} dense divided>
      <EntrySide
        logicalKey={logicalKey}
        order={dir === 'forward' ? 'former' : 'latter'}
        changes={changes.left}
      />
      <EntrySide
        logicalKey={logicalKey}
        order={dir === 'forward' ? 'latter' : 'former'}
        changes={changes.right}
      />
    </GridRow>
  )
}

interface PhysicalKeyProps {
  className?: string
  url: string
}

function PhysicalKey({ className, url }: PhysicalKeyProps) {
  const { urls } = NamedRoutes.use()
  const to = React.useMemo(() => {
    const { bucket, key, version } = s3paths.parseS3Url(url)
    return urls.bucketFile(bucket, key, version)
  }, [url, urls])
  return (
    <StyledLink className={className} to={to}>
      {url}
    </StyledLink>
  )
}

type Changes =
  | { _tag: 'added'; entry: Model.PackageEntry }
  | { _tag: 'unmodified' }
  | {
      _tag: 'modified'
      modified: Modifications
      left: Model.PackageEntry
      right: Model.PackageEntry
    }

const useEntrySideStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body1,
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  property: {
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    margin: t.spacing(1, 0, 0),
  },
  value: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  icon: {
    color: t.palette.text.secondary,
    marginRight: t.spacing(1),
  },
}))

interface EntrySideProps {
  className?: string
  logicalKey: string
  changes: Partial<Model.PackageEntry>
  order: Order
}

function EntrySide({ changes, logicalKey, order }: EntrySideProps) {
  const classes = useEntrySideStyles()
  return (
    <div className={classes.root}>
      <M.Typography variant="subtitle2" color="textSecondary">
        {logicalKey}
      </M.Typography>

      {changes.physicalKey && (
        <div className={classes.property}>
          <Icons.LinkOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={classes.value}>
            <PhysicalKey url={changes.physicalKey} />
          </Change>
        </div>
      )}

      {changes.hash && (
        <div className={classes.property}>
          <Icons.LockOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={cx(classes.hash, classes.value)}>
            {changes.hash.value}
          </Change>
        </div>
      )}

      {changes.size && (
        <div className={classes.property}>
          <Icons.InsertDriveFileOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={classes.value}>
            {readableBytes(changes.size)}
          </Change>
        </div>
      )}

      {changes.meta && (
        <div className={classes.property}>
          <Icons.Code className={classes.icon} fontSize="small" />
          <JsonDisplay value={changes.meta} />
        </div>
      )}
    </div>
  )
}

function getChanges(left?: Model.PackageEntry, right?: Model.PackageEntry): Changes {
  if (!left || !right) {
    const entry = left || right
    if (!entry) {
      throw new Error('Must be at least one entry')
    }
    return { _tag: 'added', entry }
  }

  const physicalKey = left.physicalKey !== right.physicalKey
  const hash = left.hash.value !== right.hash.value
  const size = left.size !== right.size
  const meta = JSON.stringify(left.meta) !== JSON.stringify(right.meta)
  if (!physicalKey && !hash && !size && !meta) return { _tag: 'unmodified' }

  return { _tag: 'modified', modified: { physicalKey, hash, size, meta }, left, right }
}

interface RowProps {
  className: string
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
  dir: Dir
}

function Row({ className, dir, logicalKey, left, right }: RowProps) {
  const changes = React.useMemo(() => getChanges(left, right), [left, right])

  switch (changes._tag) {
    case 'unmodified':
      return <Unmodified className={className} logicalKey={logicalKey} />
    case 'added':
      return <Added className={className} dir={dir} logicalKey={logicalKey} />
    case 'modified':
      return (
        <Modified
          className={className}
          dir={dir}
          logicalKey={logicalKey}
          left={changes.left}
          right={changes.right}
          modified={changes.modified}
        />
      )
    default:
      assertNever(changes)
  }
}

const useStyles = M.makeStyles((t) => ({
  row: {
    borderBottom: `1px solid ${t.palette.divider}`,
    '&:last-child': {
      borderBottom: 'none',
    },
  },
  head: {
    background: t.palette.background.default,
    ...t.typography.caption,
  },
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: t.spacing(2),
  },
}))

interface EntriesDiffProps {
  left: Revision
  right: Revision
}

function EntriesDiff({ left, right }: EntriesDiffProps) {
  const classes = useStyles()

  const entries = React.useMemo(() => {
    const leftData = left.contentsFlatMap || {}
    const rightData = right.contentsFlatMap || {}

    const logicalKeys = Object.keys({ ...leftData, ...rightData }).sort()
    return {
      left: leftData,
      right: rightData,
      keys: logicalKeys,
    }
  }, [left.contentsFlatMap, right.contentsFlatMap])

  const dir: Dir = React.useMemo(
    () => (left.modified > right.modified ? 'backward' : 'forward'),
    [left.modified, right.modified],
  )

  if (entries.keys.length === 0) {
    return <div className={classes.empty}>No entries found</div>
  }

  return (
    <div>
      <GridRow className={cx(classes.row, classes.head)} dense divided>
        {left.hash}
        {right.hash}
      </GridRow>
      {entries.keys.map((logicalKey) => (
        <Row
          className={classes.row}
          key={logicalKey}
          logicalKey={logicalKey}
          left={entries.left[logicalKey]}
          right={entries.right[logicalKey]}
          dir={dir}
        />
      ))}
    </div>
  )
}

interface EntriesDiffWrapperProps {
  left: RevisionResult
  right: RevisionResult
}

export default function EntriesDiffHandler({ left, right }: EntriesDiffWrapperProps) {
  if (left._tag === 'idle' || right._tag === 'idle') {
    return null
  }

  if (left._tag === 'loading' || right._tag === 'loading') {
    return <Lab.Skeleton width="100%" height={200} />
  }

  if (left._tag === 'error' || right._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return <EntriesDiff left={left.revision} right={right.revision} />
}
