import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import * as Model from 'model'
import { trimCenter } from 'utils/string'

import type { RevisionsResult, Revision } from '../useRevisionsPair'

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
  revisions: [Revision, Revision]
  changesOnly?: boolean
}

function Row({
  className,
  logicalKey,
  base,
  other,
  revisions,
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
            <span className={classes.hashLegend}>
              {trimCenter(revisions[0].hash, 12)}
            </span>
            <Preview physicalKey={changes.base.physicalKey} />
          </M.Paper>
          <M.Paper elevation={0} className={classes.previewPaper}>
            <span className={classes.hashLegend}>
              {trimCenter(revisions[1].hash, 12)}
            </span>
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
  revisions: [Revision, Revision]
  changesOnly?: boolean
}

function EntriesDiff({ revisions, changesOnly = false }: EntriesDiffProps) {
  const classes = useStyles()
  const [base, other] = revisions

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
          revisions={revisions}
          changesOnly={changesOnly}
        />
      ))}
    </M.List>
  )
}

interface EntriesDiffWrapperProps {
  revisionsResult: RevisionsResult
  changesOnly?: boolean
}

export default function EntriesDiffHandler({
  revisionsResult,
  changesOnly,
}: EntriesDiffWrapperProps) {
  if (revisionsResult._tag === 'loading') {
    return <Lab.Skeleton width="100%" height={200} />
  }

  if (revisionsResult._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return <EntriesDiff revisions={revisionsResult.revisions} changesOnly={changesOnly} />
}
