import cx from 'classnames'
import invariant from 'invariant'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import * as Model from 'model'

import type { RevisionsResult, Revision } from '../useRevisionsPair'

import Preview from './Preview'
import Revisioned from './Revisioned'
import useColors from './useColors'

type Color = keyof ReturnType<typeof useColors>

function LogicalKey({ color, children }: React.PropsWithChildren<{ color: Color }>) {
  const colors = useColors()
  return <span className={cx(colors[color], colors.inline)}>{children}</span>
}

interface EntryProps {
  children: React.ReactNode
  logicalKey: React.ReactNode
  className: string
}

function Entry({ children, className, logicalKey }: EntryProps) {
  const [expanded, setExpanded] = React.useState(false)
  const toggle = React.useCallback(() => setExpanded((x) => !x), [])
  return (
    <>
      <M.ListItem button onClick={toggle} className={className}>
        <M.ListItemIcon>
          {expanded ? <Icons.ExpandLess /> : <Icons.ExpandMore />}
        </M.ListItemIcon>
        <M.ListItemText primary={logicalKey} />
      </M.ListItem>

      <M.Collapse in={expanded} unmountOnExit>
        <M.ListItem>{children}</M.ListItem>
      </M.Collapse>
    </>
  )
}

type Change =
  | { _tag: 'unmodified'; entry: Model.PackageEntry }
  | { _tag: 'added'; entry: Model.PackageEntry }
  | { _tag: 'removed'; entry: Model.PackageEntry }
  | { _tag: 'modified'; base: Model.PackageEntry; other: Model.PackageEntry }

function isModified(base: Model.PackageEntry, other: Model.PackageEntry): boolean {
  if (base.physicalKey !== other.physicalKey) return true
  if (base.hash.value !== other.hash.value) return true
  if (base.size !== other.size) return true
  if (JSON.stringify(base.meta) !== JSON.stringify(other.meta)) return true
  return false
}

function getChange(
  baseEntry?: Model.PackageEntry,
  otherEntry?: Model.PackageEntry,
): Change {
  invariant(baseEntry || otherEntry, 'We iterate over entries, some entry must exist')

  if (!baseEntry) return { _tag: 'added', entry: otherEntry! }
  if (!otherEntry) return { _tag: 'removed', entry: baseEntry! }

  return isModified(baseEntry, otherEntry)
    ? { _tag: 'modified', base: baseEntry, other: otherEntry }
    : { _tag: 'unmodified', entry: baseEntry }
}

function getChanges([base, other]: [Revision, Revision], changesOnly: boolean) {
  return Object.keys({ ...base.contentsFlatMap, ...other.contentsFlatMap })
    .sort()
    .map((logicalKey) => ({
      logicalKey,
      change: getChange(
        base.contentsFlatMap?.[logicalKey],
        other.contentsFlatMap?.[logicalKey],
      ),
    }))
    .filter(({ change }) => !changesOnly || change._tag !== 'unmodified')
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
  split: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: t.spacing(2),
    width: '100%',
  },
  preview: {
    background: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    margin: t.spacing(2, 0),
    padding: t.spacing(3),
    position: 'relative',
  },
  single: {
    width: '100%',
  },
}))

interface EntriesDiffProps {
  revisions: [Revision, Revision]
  changesOnly: boolean
}

function EntriesDiff({ revisions, changesOnly }: EntriesDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(
    () => getChanges(revisions, changesOnly),
    [revisions, changesOnly],
  )

  if (changes.length === 0) {
    return <div className={classes.empty}>No entries found</div>
  }

  return (
    <M.List dense>
      {changes.map(({ logicalKey, change }) => (
        <Entry
          key={logicalKey}
          className={classes.row}
          logicalKey={<LogicalKey color={change._tag}>{logicalKey}</LogicalKey>}
        >
          {change._tag === 'modified' ? (
            <div className={classes.split}>
              <Revisioned className={classes.preview} hash={revisions[0].hash}>
                <Preview physicalKey={change.base.physicalKey} />
              </Revisioned>
              <Revisioned className={classes.preview} hash={revisions[1].hash}>
                <Preview physicalKey={change.other.physicalKey} />
              </Revisioned>
            </div>
          ) : (
            <div className={cx(classes.preview, classes.single)}>
              <Preview physicalKey={change.entry.physicalKey} />
            </div>
          )}
        </Entry>
      ))}
    </M.List>
  )
}

interface EntriesDiffWrapperProps {
  revisionsResult: RevisionsResult
  changesOnly: boolean
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
