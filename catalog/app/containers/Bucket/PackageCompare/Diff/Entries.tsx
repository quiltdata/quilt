import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import * as Model from 'model'
import { trimCenter } from 'utils/string'

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
  previewPaper: {
    padding: t.spacing(3),
    position: 'relative',
    margin: t.spacing(2, 0),
  },
  single: {
    width: '100%',
  },
  hashLegend: {
    position: 'absolute',
    ...t.typography.caption,
    color: t.palette.text.hint,
    top: t.spacing(0.5),
    right: t.spacing(0.5),
  },
}))

interface RowProps {
  className: string
  logicalKey: string
  left?: Model.PackageEntry
  right?: Model.PackageEntry
  leftRevision?: Revision
  rightRevision?: Revision
  changesOnly?: boolean
}

function Row({
  className,
  logicalKey,
  left,
  right,
  leftRevision,
  rightRevision,
  changesOnly = false,
}: RowProps) {
  const changes = React.useMemo(() => getChanges(left, right), [left, right])
  const colors = useColors()
  const classes = useRowStyles()
  const [expanded, setExpanded] = React.useState(false)
  const toggle = React.useCallback(() => setExpanded((x) => !x), [])

  if (changesOnly && changes._tag === 'unmodified') {
    return null
  }

  const getPreviewContent = () => {
    if (changes._tag === 'modified') {
      return (
        <div className={classes.split}>
          <M.Paper elevation={0} className={classes.previewPaper}>
            {leftRevision && (
              <span className={classes.hashLegend}>
                {trimCenter(leftRevision.hash, 12)}
              </span>
            )}
            <Preview physicalKey={changes.left.physicalKey} />
          </M.Paper>
          <M.Paper elevation={0} className={classes.previewPaper}>
            {rightRevision && (
              <span className={classes.hashLegend}>
                {trimCenter(rightRevision.hash, 12)}
              </span>
            )}
            <Preview physicalKey={changes.right.physicalKey} />
          </M.Paper>
        </div>
      )
    }

    return (
      <M.Paper className={cx(classes.previewPaper, classes.single)} elevation={0}>
        <Preview physicalKey={changes.entry.physicalKey} />
      </M.Paper>
    )
  }

  return (
    <>
      <M.ListItem button onClick={toggle} className={className}>
        <M.ListItemIcon>
          {expanded ? <Icons.ExpandLess /> : <Icons.ExpandMore />}
        </M.ListItemIcon>
        <M.ListItemText
          primary={
            <span className={cx(colors[changes._tag], colors.inline)}>{logicalKey}</span>
          }
        />
      </M.ListItem>
      {expanded && <M.ListItem>{getPreviewContent()}</M.ListItem>}
    </>
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
  changesOnly?: boolean
}

function EntriesDiff({ left, right, changesOnly = false }: EntriesDiffProps) {
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
    <M.List dense>
      {entries.keys.map((logicalKey) => (
        <Row
          className={classes.row}
          key={logicalKey}
          logicalKey={logicalKey}
          left={entries.left[logicalKey]}
          right={entries.right[logicalKey]}
          leftRevision={left}
          rightRevision={right}
          changesOnly={changesOnly}
        />
      ))}
    </M.List>
  )
}

interface EntriesDiffWrapperProps {
  left: RevisionResult
  right: RevisionResult
  changesOnly?: boolean
}

export default function EntriesDiffHandler({
  left,
  right,
  changesOnly,
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
    <EntriesDiff left={left.revision} right={right.revision} changesOnly={changesOnly} />
  )
}
