import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import assertNever from 'utils/assertNever'
import JsonDisplay from 'components/JsonDisplay'
import * as Model from 'model'
import * as NamedRoutes from 'utils/NamedRoutes'
import StyledLink from 'utils/StyledLink'
import { readableBytes } from 'utils/string'
import * as s3paths from 'utils/s3paths'

import type { Revision, RevisionResult } from '../useRevision'

import Change from './Diff'
import type { Dir, Side } from './Diff'

type Changes =
  | { _tag: 'unmodified'; logicalKey: string }
  | { _tag: 'introduced'; logicalKey: string; entry: Model.PackageEntry; dir: Dir }
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
    borderLeft: `1px solid ${t.palette.divider}`,
    borderRight: `1px solid ${t.palette.divider}`,
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  hideOverflow: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}))

interface EntrySideProps {
  logicalKey: string
  side: Side
  changes: Partial<Model.PackageEntry> | 'introduced' | 'unmodified'
  dir: Dir
}

function EntrySide({ changes, logicalKey, dir, side }: EntrySideProps) {
  const classes = useEntrySideStyles()
  if (changes === 'introduced') {
    return (
      <M.Typography className={classes.root} variant="subtitle2" color="textSecondary">
        <Change dir={dir} side={side}>
          {logicalKey}
        </Change>
      </M.Typography>
    )
  }
  if (changes === 'unmodified') {
    return (
      <M.Typography className={classes.root} variant="subtitle2" color="textSecondary">
        {logicalKey}
      </M.Typography>
    )
  }
  return (
    <div className={classes.root}>
      <M.Typography variant="subtitle2" color="textSecondary">
        {logicalKey}
      </M.Typography>

      {changes.physicalKey && (
        <M.Typography className={classes.hideOverflow}>
          <M.Typography variant="body2" component="span">
            <b>URL</b>:{' '}
          </M.Typography>
          <Change dir={dir} side={side}>
            <PhysicalKey url={changes.physicalKey} />
          </Change>
        </M.Typography>
      )}

      {changes.hash && (
        <M.Typography className={classes.hideOverflow}>
          <M.Typography variant="body2" component="span">
            <b>Hash</b>:{' '}
          </M.Typography>
          <Change dir={dir} side={side} className={classes.hash}>
            {changes.hash.value}
          </Change>
        </M.Typography>
      )}

      {changes.size && (
        <M.Typography variant="body2" className={classes.hideOverflow}>
          <b>Size</b>:{' '}
          <Change dir={dir} side={side}>
            {readableBytes(changes.size)}
          </Change>
        </M.Typography>
      )}

      {changes.meta && <JsonDisplay value={changes.meta} />}
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

function useChanges(
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
    return { _tag: 'introduced', logicalKey, entry, dir }
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

const useStyles = M.makeStyles((t) => ({
  table: {},
  entryRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    borderTop: `1px solid ${t.palette.divider}`,
    borderBottom: `1px solid ${t.palette.divider}`,
  },
  hash: {
    fontFamily: t.typography.monospace.fontFamily,
  },
  colorInherit: {
    color: 'inherit',
  },
  entryCell: {
    overflow: 'hidden',
    padding: t.spacing(1),
    border: `1px solid ${t.palette.divider}`,
  },
}))

interface EntriesRowProps {
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
  dir: Dir
}

function EntriesRow({ dir, logicalKey, left, right }: EntriesRowProps) {
  const classes = useStyles()

  const changes = useChanges(dir, logicalKey, left, right)

  switch (changes._tag) {
    case 'unmodified':
      return (
        <div className={classes.entryRow}>
          <M.Typography variant="subtitle2" color="textSecondary">
            <M.Box p={1}>{logicalKey}</M.Box>
          </M.Typography>
          <M.Typography variant="subtitle2" color="textSecondary" component="i">
            Unmodified
          </M.Typography>
        </div>
      )
    case 'introduced':
      return (
        <EntrySide logicalKey={logicalKey} side="left" dir={dir} changes="introduced" />
      )
    case 'modified':
      return (
        <div className={classes.entryRow}>
          <EntrySide
            logicalKey={logicalKey}
            side="left"
            dir={dir}
            changes={changes.left}
          />
          <EntrySide
            logicalKey={logicalKey}
            side="right"
            dir={dir}
            changes={changes.right}
          />
        </div>
      )
    default:
      assertNever(changes)
  }
}

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
    return { left: leftData, right: rightData, keys: logicalKeys }
  }, [left.contentsFlatMap, right.contentsFlatMap])

  const dir: Dir = React.useMemo(
    () => (left.modified > right.modified ? 'ltr' : 'rtl'),
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
    <div className={classes.table}>
      <div className={classes.entryRow}>
        <div className={classes.entryCell}>{left.hash}</div>
        <div className={classes.entryCell}>{right.hash}</div>
      </div>
      {entries.keys.map((logicalKey) => (
        <EntriesRow
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
