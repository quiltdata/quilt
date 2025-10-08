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
      base: Model.PackageEntry
      other: Model.PackageEntry
    }

function getChanges(base?: Model.PackageEntry, other?: Model.PackageEntry): Changes {
  if (!base || !other) {
    const entry = base || other
    if (!entry) {
      throw new Error('Must be at least one entry')
    }
    return { _tag: 'added', entry }
  }

  const physicalKey = base.physicalKey !== other.physicalKey
  const hash = base.hash.value !== other.hash.value
  const size = base.size !== other.size
  const meta = JSON.stringify(base.meta) !== JSON.stringify(other.meta)
  if (!physicalKey && !hash && !size && !meta) return { _tag: 'unmodified', entry: base }

  return { _tag: 'modified', modified: { physicalKey, hash, size, meta }, base, other }
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
  base?: Model.PackageEntry
  other?: Model.PackageEntry
  baseRevision?: Revision
  otherRevision?: Revision
  changesOnly?: boolean
}

function Row({
  className,
  logicalKey,
  base,
  other,
  baseRevision,
  otherRevision,
  changesOnly = false,
}: RowProps) {
  const changes = React.useMemo(() => getChanges(base, other), [base, other])
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
            {baseRevision && (
              <span className={classes.hashLegend}>
                {trimCenter(baseRevision.hash, 12)}
              </span>
            )}
            <Preview physicalKey={changes.base.physicalKey} />
          </M.Paper>
          <M.Paper elevation={0} className={classes.previewPaper}>
            {otherRevision && (
              <span className={classes.hashLegend}>
                {trimCenter(otherRevision.hash, 12)}
              </span>
            )}
            <Preview physicalKey={changes.other.physicalKey} />
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
  base: Revision
  other: Revision
  changesOnly?: boolean
}

function EntriesDiff({ base, other, changesOnly = false }: EntriesDiffProps) {
  const classes = useStyles()

  const entries = React.useMemo(() => {
    const baseData = base.contentsFlatMap || {}
    const otherData = other.contentsFlatMap || {}

    const logicalKeys = Object.keys({ ...baseData, ...otherData }).sort()
    return {
      base: baseData,
      other: otherData,
      keys: logicalKeys,
    }
  }, [base.contentsFlatMap, other.contentsFlatMap])

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
          base={entries.base[logicalKey]}
          other={entries.other[logicalKey]}
          baseRevision={base}
          otherRevision={other}
          changesOnly={changesOnly}
        />
      ))}
    </M.List>
  )
}

interface EntriesDiffWrapperProps {
  base: RevisionResult
  other: RevisionResult
  changesOnly?: boolean
}

export default function EntriesDiffHandler({
  base,
  other,
  changesOnly,
}: EntriesDiffWrapperProps) {
  if (base._tag === 'loading' || other._tag === 'loading') {
    return <Lab.Skeleton width="100%" height={200} />
  }

  if (base._tag === 'error' || other._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return (
    <EntriesDiff base={base.revision} other={other.revision} changesOnly={changesOnly} />
  )
}
