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
  if (!base.contentsFlatMap && !other.contentsFlatMap) {
    throw new Error(`Package manifests are too large`)
  }
  if (!base.contentsFlatMap) {
    throw new Error(`Package manifest ${base.hash} is too large`)
  }
  if (!other.contentsFlatMap) {
    throw new Error(`Package manifest ${other.hash} is too large`)
  }

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

const usePreviewBoxStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
    borderRadius: t.shape.borderRadius,
    color: 'inherit',
    margin: t.spacing(2, 0),
    padding: t.spacing(3),
    position: 'relative',
  },
  border: {
    borderStyle: 'solid',
    borderWidth: '2px',
  },
}))

interface PreviewBoxProps {
  children: React.ReactNode
  className?: string
  hash?: string
  tag: Change['_tag']
}

function PreviewBox({ hash, className, children, tag }: PreviewBoxProps) {
  const colors = useColors()
  const classes = usePreviewBoxStyles()
  const cl = cx(
    classes.root,
    tag !== 'unmodified' && colors[tag],
    tag !== 'unmodified' && classes.border,
    className,
  )
  return hash ? (
    <Revisioned className={cl} hash={hash}>
      {children}
    </Revisioned>
  ) : (
    <div className={cl}>{children}</div>
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
  single: {
    width: '100%',
  },
  split: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: t.spacing(2),
    width: '100%',
  },
}))

interface EntriesDiffProps {
  revisions: [Revision, Revision]
  changesOnly: boolean
}

function EntriesDiff({ revisions, changesOnly }: EntriesDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(() => {
    try {
      return getChanges(revisions, changesOnly)
    } catch (e) {
      return e instanceof Error ? e : new Error(`Unexpected error: ${e}`)
    }
  }, [revisions, changesOnly])

  if (changes instanceof Error) {
    return <Lab.Alert severity="error">{changes.message}</Lab.Alert>
  }

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
              <PreviewBox tag="added" hash={revisions[0].hash}>
                <Preview physicalKey={change.base.physicalKey} />
              </PreviewBox>
              <PreviewBox tag="removed" hash={revisions[1].hash}>
                <Preview physicalKey={change.other.physicalKey} />
              </PreviewBox>
            </div>
          ) : (
            <PreviewBox className={classes.single} tag={change._tag}>
              <Preview physicalKey={change.entry.physicalKey} />
            </PreviewBox>
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
      <Lab.Alert severity="error">
        <Lab.AlertTitle>Error loading revisions</Lab.AlertTitle>
        {revisionsResult.error.message}
      </Lab.Alert>
    )
  }

  return <EntriesDiff revisions={revisionsResult.revisions} changesOnly={changesOnly} />
}
