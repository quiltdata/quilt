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

const useAddedStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
  },
  cell: {
    padding: t.spacing(1.5, 1),
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
    <GridRow className={cx(classes.root, className)}>
      <div className={classes.cell}>
        <Change order={dir === 'forward' ? 'former' : 'latter'}>{logicalKey}</Change>
      </div>
      <div className={classes.cell}>
        <Change order={dir === 'forward' ? 'latter' : 'former'}>{logicalKey}</Change>
      </div>
    </GridRow>
  )
}

const useUnmodifiedStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    padding: t.spacing(1.5, 1),
  },
  label: {
    paddingLeft: t.spacing(1),
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
      <span>{logicalKey}</span>
      <i className={classes.label}>Unmodified</i>
    </GridRow>
  )
}

const useGridRowStyles = M.makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
})

interface GridRowProps {
  className?: string
  children: React.ReactNode
}

function GridRow({ className, children }: GridRowProps) {
  const classes = useGridRowStyles()
  return <div className={cx(className, classes.root)}>{children}</div>
}

type Changes =
  | { _tag: 'unmodified'; logicalKey: string }
  | { _tag: 'added'; logicalKey: string; entry: Model.PackageEntry; dir: Dir }
  | {
      _tag: 'modified'
      logicalKey: string
      left: Partial<Model.PackageEntry>
      right: Partial<Model.PackageEntry>
    }

const useEntrySideStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    padding: t.spacing(1),
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  property: {
    whiteSpace: 'nowrap',
    display: 'flex',
    alignItems: 'center',
    marginTop: t.spacing(1),
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

function EntrySide({ className, changes, logicalKey, order }: EntrySideProps) {
  const classes = useEntrySideStyles()
  return (
    <div className={cx(classes.root, className)}>
      <M.Typography variant="subtitle2" color="textSecondary">
        {logicalKey}
      </M.Typography>

      {changes.physicalKey && (
        <M.Typography className={classes.property}>
          <Icons.LinkOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={classes.value}>
            <PhysicalKey url={changes.physicalKey} />
          </Change>
        </M.Typography>
      )}

      {changes.hash && (
        <M.Typography className={classes.property}>
          <Icons.LockOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={cx(classes.hash, classes.value)}>
            {changes.hash.value}
          </Change>
        </M.Typography>
      )}

      {changes.size && (
        <M.Typography variant="body2" className={classes.property}>
          <Icons.InsertDriveFileOutlined className={classes.icon} fontSize="small" />
          <Change order={order} className={classes.value}>
            {readableBytes(changes.size)}
          </Change>
        </M.Typography>
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

function getEntryChanges(
  entry: Model.PackageEntry,
  modified: Record<keyof Model.PackageEntry, boolean>,
) {
  return {
    physicalKey: modified.physicalKey ? entry.physicalKey : undefined,
    hash: modified.hash ? entry.hash : undefined,
    size: modified.size ? entry.size : undefined,
    meta: modified.meta ? entry.meta : undefined,
  }
}

function getChanges(
  dir: Dir,
  logicalKey: string,
  left?: Model.PackageEntry,
  right?: Model.PackageEntry,
): Changes {
  if (!left || !right) {
    const entry = left || right
    if (!entry) {
      throw new Error('Must be at least one entry')
    }
    return { _tag: 'added', logicalKey, entry, dir }
  }

  const physicalKey = left.physicalKey !== right.physicalKey
  const hash = left.hash.value !== right.hash.value
  const size = left.size !== right.size
  const meta = JSON.stringify(left.meta) !== JSON.stringify(right.meta)
  if (!physicalKey && !hash && !size && !meta) return { _tag: 'unmodified', logicalKey }
  const modified = { physicalKey, hash, size, meta }
  return {
    _tag: 'modified',
    logicalKey,
    left: getEntryChanges(left, modified),
    right: getEntryChanges(right, modified),
  }
}

const useEntriesRowStyles = M.makeStyles((t) => ({
  side: {
    borderLeft: `1px solid ${t.palette.divider}`,
  },
}))

interface EntriesRowProps {
  className: string
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
  dir: Dir
}

function EntriesRow({ className, dir, logicalKey, left, right }: EntriesRowProps) {
  const classes = useEntriesRowStyles()

  const changes = React.useMemo(
    () => getChanges(dir, logicalKey, left, right),
    [dir, logicalKey, left, right],
  )

  switch (changes._tag) {
    case 'unmodified':
      return <Unmodified className={className} logicalKey={logicalKey} />
    case 'added':
      return <Added className={className} dir={dir} logicalKey={logicalKey} />
    case 'modified':
      return (
        <GridRow className={className}>
          <EntrySide
            logicalKey={logicalKey}
            order={dir === 'forward' ? 'former' : 'latter'}
            changes={changes.left}
          />
          <EntrySide
            className={classes.side}
            logicalKey={logicalKey}
            order={dir === 'forward' ? 'latter' : 'former'}
            changes={changes.right}
          />
        </GridRow>
      )
    default:
      assertNever(changes)
  }
}

const useStyles = M.makeStyles((t) => ({
  row: {
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  head: {
    overflow: 'hidden',
    padding: t.spacing(1),
    background: t.palette.background.default,
    '& + &': {
      borderLeft: `1px solid ${t.palette.divider}`,
    },
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
    return (
      <M.Typography
        variant="body2"
        color="textSecondary"
        style={{ fontStyle: 'italic', textAlign: 'center', padding: 16 }}
      >
        No entries found
      </M.Typography>
    )
  }

  return (
    <div>
      <GridRow className={classes.row}>
        <div className={classes.head}>{left.hash}</div>
        <div className={classes.head}>{right.hash}</div>
      </GridRow>
      {entries.keys.map((logicalKey) => (
        <EntriesRow
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
