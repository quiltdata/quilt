import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'
import * as JSONPointer from 'utils/JSONPointer'
import { readableBytes } from 'utils/string'
import assertNever from 'utils/assertNever'

import type { Revision, RevisionsResult } from '../useRevisionsPair'

import useColors from './useColors'
import { compareJsons, compareJsonRecords, type Change } from './compareJsons'

type WhatChanged =
  | { _tag: 'meta'; keys: Change[] }
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

interface MetaKeyProps {
  className: string
  change: Change
}

function MetaKey({ className, change }: MetaKeyProps) {
  const colors = useColors()
  const tooltip = React.useMemo(() => {
    switch (change._tag) {
      case 'modified':
        return `${JSON.stringify(change.oldValue)} → ${JSON.stringify(change.newValue)}`
      case 'added':
        return JSON.stringify(change.newValue)
      case 'removed':
        return JSON.stringify(change.oldValue)
      default:
        assertNever(change)
    }
  }, [change])
  return (
    <M.Tooltip title={tooltip}>
      <span className={className}>
        <span className={cx(colors[change._tag], colors.inline)}>
          {change.pointer.reduce(
            (memo, key, index) =>
              memo.length
                ? [
                    ...memo,
                    <Icons.ArrowRight key={`separator_${index}`} fontSize="inherit" />,
                    key,
                  ]
                : [key],
            [] as React.ReactNode[],
          )}
        </span>
      </span>
    </M.Tooltip>
  )
}

const useMetaKeysStyles = M.makeStyles((t) => ({
  keys: {
    display: 'inline-flex',
    flexWrap: 'wrap',
    gap: t.spacing(0.75),
  },
  key: {
    '&::after': {
      content: '", "',
    },
    '&:last-child::after': {
      content: '""',
    },
  },
}))

interface MetaKeysProps {
  change: Extract<WhatChanged, { _tag: 'meta' }>
}

function MetaKeys({ change }: MetaKeysProps) {
  const classes = useMetaKeysStyles()
  return (
    <span>
      Changed keys:{' '}
      <span className={classes.keys}>
        {change.keys.map((metaChange) => (
          <MetaKey
            key={JSONPointer.stringify(metaChange.pointer)}
            change={metaChange}
            className={classes.key}
          />
        ))}
      </span>
    </span>
  )
}

const useModifiedEntryStyles = M.makeStyles({
  label: {
    '&::after': {
      content: '", "',
    },
  },
})

interface ModifiedEntryProps {
  change: Extract<WhatChanged, { _tag: 'modified' }>
}

function ModifiedEntry({ change }: ModifiedEntryProps) {
  const classes = useModifiedEntryStyles()
  const colors = useColors()
  if (!change.hashChanged) return <span>Modified</span>

  return (
    <span>
      <span className={classes.label}>Content changed</span>
      {change.sizeChanged && (
        <span className={cx(colors.modified, colors.inline)}>
          {readableBytes(change.oldSize)} → {readableBytes(change.newSize)}
        </span>
      )}
    </span>
  )
}

function getMetaChange([base, other]: [Revision, Revision]): Extract<
  WhatChanged,
  { _tag: 'meta' }
> | null {
  const keys = compareJsonRecords(base.userMeta || {}, other.userMeta || {})
  return keys.length ? { _tag: 'meta', keys } : null
}

function getEntryChanges([base, other]: [Revision, Revision]): WhatChanged[] {
  if (!base.contentsFlatMap && !other.contentsFlatMap) {
    throw new Error(`Package manifests are too large`)
  }
  if (!base.contentsFlatMap) {
    throw new Error(`Package manifest ${base.hash} is too large`)
  }
  if (!other.contentsFlatMap) {
    throw new Error(`Package manifest ${other.hash} is too large`)
  }
  const baseData = base.contentsFlatMap
  const otherData = other.contentsFlatMap
  const logicalKeys = Object.keys({ ...baseData, ...otherData }).sort()
  const entryChanges: WhatChanged[] = []

  for (const logicalKey of logicalKeys) {
    const baseEntry = baseData[logicalKey]
    const otherEntry = otherData[logicalKey]

    if (!baseEntry) {
      entryChanges.push({ _tag: 'added', logicalKey })
    } else if (!otherEntry) {
      entryChanges.push({ _tag: 'removed', logicalKey })
    } else {
      const hashChanged = baseEntry.hash.value !== otherEntry.hash.value
      const sizeChanged = baseEntry.size !== otherEntry.size
      const physicalKeyChanged = baseEntry.physicalKey !== otherEntry.physicalKey
      const metaChanged = compareJsons(baseEntry.meta, otherEntry.meta)

      if (hashChanged || sizeChanged || physicalKeyChanged || metaChanged) {
        entryChanges.push({
          _tag: 'modified',
          logicalKey,
          hashChanged,
          sizeChanged,
          oldSize: sizeChanged ? baseEntry.size : undefined,
          newSize: sizeChanged ? otherEntry.size : undefined,
        })
      }
    }
  }

  return entryChanges
}

function getChanges(revisions: [Revision, Revision]): WhatChanged[] | Error {
  try {
    return [getMetaChange(revisions), ...getEntryChanges(revisions)].filter(
      Boolean,
    ) as WhatChanged[]
  } catch (e) {
    return e instanceof Error ? e : new Error(`Unexpected error: ${e}`)
  }
}

interface SummaryItemProps {
  change: WhatChanged
}

function SummaryItem({ change }: SummaryItemProps) {
  const colors = useColors()
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
            primary={<span className={colors.added}>{change.logicalKey}</span>}
            secondary="Added"
          />
        </M.ListItem>
      )
    case 'removed':
      return (
        <M.ListItem disableGutters>
          <M.ListItemText
            primary={<span className={colors.removed}>{change.logicalKey}</span>}
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
  revisions: [Revision, Revision]
}

function SummaryDiff({ revisions }: SummaryDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(() => getChanges(revisions), [revisions])

  if (changes instanceof Error) {
    return <Lab.Alert severity="error">{changes.message}</Lab.Alert>
  }

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
  revisionsResult: RevisionsResult
}

export default function SummaryDiffHandler({ revisionsResult }: SummaryDiffHandlerProps) {
  if (revisionsResult._tag === 'loading') {
    return <Skeleton width="100%" height={200} />
  }

  if (revisionsResult._tag === 'error') {
    return (
      <Lab.Alert severity="error">
        <Lab.AlertTitle>Error loading revisions</Lab.AlertTitle>
        {revisionsResult.error.message}
      </Lab.Alert>
    )
  }

  return <SummaryDiff revisions={revisionsResult.revisions} />
}
