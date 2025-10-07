import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as Model from 'model'

import type { Revision, RevisionResult } from '../useRevision'

import Preview from './Preview'
import useColors from './useColors'

type Modifications = Record<keyof Model.PackageEntry, boolean>

type Changes =
  | { _tag: 'added'; entry: Model.PackageEntry }
  | { _tag: 'unmodified'; entry: Model.PackageEntry }
  | {
      _tag: 'modified'
      modified: Modifications
      left: Model.PackageEntry
      right: Model.PackageEntry
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
  if (!physicalKey && !hash && !size && !meta) return { _tag: 'unmodified', entry: left }

  return { _tag: 'modified', modified: { physicalKey, hash, size, meta }, left, right }
}

const useRowStyles = M.makeStyles((t) => ({
  split: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: t.spacing(2),
    width: '100%',
  },
}))

interface RowProps {
  className: string
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
  showChangesOnly?: boolean
}

function Row({ className, logicalKey, left, right, showChangesOnly = false }: RowProps) {
  const changes = React.useMemo(() => getChanges(left, right), [left, right])
  const colors = useColors()
  const classes = useRowStyles()

  // If showChangesOnly is true and this is unmodified, don't render
  if (showChangesOnly && changes._tag === 'unmodified') {
    return null
  }

  return (
    <M.Accordion className={className}>
      <M.AccordionSummary expandIcon={<M.Icon>expand_more</M.Icon>}>
        <span className={cx(colors[changes._tag], colors.inline)}>{logicalKey}</span>
      </M.AccordionSummary>
      <M.AccordionDetails>
        {changes._tag === 'modified' ? (
          <div className={classes.split}>
            <div>
              <M.Typography variant="subtitle2" gutterBottom>
                Previous Version
              </M.Typography>
              <Preview physicalKey={changes.left.physicalKey} />
            </div>
            <div>
              <M.Typography variant="subtitle2" gutterBottom>
                Current Version
              </M.Typography>
              <Preview physicalKey={changes.right.physicalKey} />
            </div>
          </div>
        ) : (
          <Preview physicalKey={changes.entry.physicalKey} />
        )}
      </M.AccordionDetails>
    </M.Accordion>
  )
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
  showChangesOnly?: boolean
}

function EntriesDiff({ left, right, showChangesOnly = false }: EntriesDiffProps) {
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

  if (entries.keys.length === 0) {
    return <div className={classes.empty}>No entries found</div>
  }

  return (
    <div>
      {entries.keys.map((logicalKey) => (
        <Row
          className={classes.row}
          key={logicalKey}
          logicalKey={logicalKey}
          left={entries.left[logicalKey]}
          right={entries.right[logicalKey]}
          showChangesOnly={showChangesOnly}
        />
      ))}
    </div>
  )
}

interface EntriesDiffWrapperProps {
  left: RevisionResult
  right: RevisionResult
  showChangesOnly?: boolean
}

export default function EntriesDiffHandler({
  left,
  right,
  showChangesOnly,
}: EntriesDiffWrapperProps) {
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

  return (
    <EntriesDiff
      left={left.revision}
      right={right.revision}
      showChangesOnly={showChangesOnly}
    />
  )
}
