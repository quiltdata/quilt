import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import { readableBytes } from 'utils/string'

type WhatChanged =
  | { _tag: 'meta'; keys: string[] }
  | {
      _tag: 'modified'
      logicalKey: string
      hashChanged: boolean
      sizeChanged: boolean
      oldSize?: number
      newSize?: number
    }
  | { _tag: 'added'; logicalKey: string }
  | { _tag: 'removed'; logicalKey: string }

import type { Revision, RevisionResult } from '../useRevision'

const useMetaKeysStyles = M.makeStyles((t) => ({
  key: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.5),
  },
}))

function MetaKeys({ change }: { change: Extract<WhatChanged, { _tag: 'meta' }> }) {
  const classes = useMetaKeysStyles()
  return (
    <span>
      Changed keys:{' '}
      <span className={classes.key}>
        {change.keys.map((label, index) => (
          <M.Chip label={label} size="small" key={index} component="span" />
        ))}
      </span>
    </span>
  )
}

function ModifiedEntry({
  change,
}: {
  change: Extract<WhatChanged, { _tag: 'modified' }>
}) {
  if (change.hashChanged && change.sizeChanged) {
    return (
      <span>
        Content changed, {readableBytes(change.oldSize!)} →{' '}
        {readableBytes(change.newSize!)}
      </span>
    )
  }

  if (change.hashChanged) {
    return <span>Content changed</span>
  }

  if (change.sizeChanged) {
    return (
      <span>
        {readableBytes(change.oldSize!)} → {readableBytes(change.newSize!)}
      </span>
    )
  }

  return <span>file was modified</span>
}

function getMetaChange(
  left: Revision,
  right: Revision,
): Extract<WhatChanged, { _tag: 'meta' }> | null {
  if (JSON.stringify(left.userMeta) === JSON.stringify(right.userMeta)) return null

  const leftMeta = left.userMeta || {}
  const rightMeta = right.userMeta || {}
  const combinedKeys = Object.keys({ ...leftMeta, ...rightMeta })
  return {
    _tag: 'meta' as const,
    keys: combinedKeys.filter((key) => leftMeta[key] !== rightMeta[key]),
  }
}

function getEntryChanges(left: Revision, right: Revision): WhatChanged[] {
  const leftData = left.contentsFlatMap || {}
  const rightData = right.contentsFlatMap || {}
  const logicalKeys = Object.keys({ ...leftData, ...rightData }).sort()
  const entryChanges: WhatChanged[] = []

  for (const logicalKey of logicalKeys) {
    const leftEntry = leftData[logicalKey]
    const rightEntry = rightData[logicalKey]

    if (!leftEntry) {
      entryChanges.push({ _tag: 'added', logicalKey })
    } else if (!rightEntry) {
      entryChanges.push({ _tag: 'removed', logicalKey })
    } else {
      const hashChanged = leftEntry.hash.value !== rightEntry.hash.value
      const sizeChanged = leftEntry.size !== rightEntry.size
      const physicalKeyChanged = leftEntry.physicalKey !== rightEntry.physicalKey
      const metaChanged =
        JSON.stringify(leftEntry.meta) !== JSON.stringify(rightEntry.meta)

      if (hashChanged || sizeChanged || physicalKeyChanged || metaChanged) {
        entryChanges.push({
          _tag: 'modified',
          logicalKey,
          hashChanged,
          sizeChanged,
          oldSize: sizeChanged ? leftEntry.size : undefined,
          newSize: sizeChanged ? rightEntry.size : undefined,
        })
      }
    }
  }

  return entryChanges
}

function getChanges(left: Revision, right: Revision): WhatChanged[] {
  return [getMetaChange(left, right), ...getEntryChanges(left, right)].filter(
    Boolean,
  ) as WhatChanged[]
}

const useSummaryItemStyles = M.makeStyles((t) => ({
  added: {
    backgroundColor: M.fade(t.palette.success.light, 0.3),
  },
  removed: {
    backgroundColor: M.fade(t.palette.error.light, 0.3),
  },
  removedStatus: {
    color: t.palette.error.light,
  },
}))

interface SummaryItemProps {
  change: WhatChanged
}

function SummaryItem({ change }: SummaryItemProps) {
  const classes = useSummaryItemStyles()
  switch (change._tag) {
    case 'meta':
      return (
        <M.ListItem disableGutters>
          <M.ListItemText
            primary="Package user metadata"
            secondary={<MetaKeys change={change} />}
          />
        </M.ListItem>
      )
    case 'modified':
      return (
        <M.ListItem disableGutters>
          <M.ListItemText
            primary={change.logicalKey}
            secondary={<ModifiedEntry change={change} />}
          />
        </M.ListItem>
      )
    case 'added':
      return (
        <M.ListItem disableGutters>
          <M.ListItemText
            primary={<span className={classes.added}>{change.logicalKey}</span>}
            secondary="Added"
          />
        </M.ListItem>
      )
    case 'removed':
      return (
        <M.ListItem disableGutters>
          <M.ListItemText
            primary={<span className={classes.removed}>{change.logicalKey}</span>}
            secondary="Removed"
          />
        </M.ListItem>
      )
  }
}

const useStyles = M.makeStyles((t) => ({
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: t.spacing(2),
  },
}))

interface SummaryDiffProps {
  left: Revision
  right: Revision
}

function SummaryDiff({ left, right }: SummaryDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(() => getChanges(left, right), [left, right])

  if (changes.length === 0) {
    return <M.Typography className={classes.empty}>Nothing changed</M.Typography>
  }

  return (
    <M.List dense>
      {changes.map((c, index) => (
        <SummaryItem change={c} key={index} />
      ))}
    </M.List>
  )
}

interface SummaryDiffHandlerProps {
  left: RevisionResult
  right: RevisionResult
}

export default function SummaryDiffHandler({ left, right }: SummaryDiffHandlerProps) {
  if (left._tag === 'idle' || right._tag === 'idle') {
    return null
  }

  if (left._tag === 'loading' || right._tag === 'loading') {
    return <Skeleton width="100%" height={200} />
  }

  if (left._tag === 'error' || right._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return <SummaryDiff left={left.revision} right={right.revision} />
}
