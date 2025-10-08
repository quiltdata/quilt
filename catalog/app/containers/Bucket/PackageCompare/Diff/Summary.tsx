import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import * as Icons from '@material-ui/icons'

import Skeleton from 'components/Skeleton'
import * as JSONPointer from 'utils/JSONPointer'
import { readableBytes } from 'utils/string'
import type { Json, JsonRecord } from 'utils/types'
import assertNever from 'utils/assertNever'

import type { Revision, RevisionResult } from '../useRevision'

import useColors from './useColors'

type MetaChange =
  | { _tag: 'modified'; pointer: JSONPointer.Path; oldValue: Json; newValue: Json }
  | { _tag: 'added'; pointer: JSONPointer.Path; newValue: Json }
  | { _tag: 'removed'; pointer: JSONPointer.Path; oldValue: Json }

type WhatChanged =
  | { _tag: 'meta'; keys: MetaChange[] }
  | {
      _tag: 'modified' // + {modified: {size: [old,new],hash: [old,new], meta: [old, new]}}
      logicalKey: string
      hashChanged: boolean
      sizeChanged: boolean // sizeChanged: -> sizes: [old, new]
      oldSize?: number
      newSize?: number
    }
  | { _tag: 'added'; logicalKey: string }
  | { _tag: 'removed'; logicalKey: string }

interface MetaKeyProps {
  className: string
  change: MetaChange
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
  if (!change.hashChanged) {
    // hash not changed but the `physicalKey`
    return <span>Modified</span>
  }

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

function isObject(value: any): value is JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function compareKeysRecursive(
  leftObj: JsonRecord,
  rightObj: JsonRecord,
  prefix: JSONPointer.Path = [],
): MetaChange[] {
  const changedKeys: MetaChange[] = []
  const combinedKeys = Object.keys({ ...leftObj, ...rightObj })

  for (const key of combinedKeys) {
    const pointer = prefix.length ? [...prefix, key] : [key]
    const leftValue = leftObj[key]
    const rightValue = rightObj[key]

    // If values are strictly equal, no change
    if (leftValue === rightValue) {
      continue
    }

    // Handle missing keys
    if (leftValue === undefined) {
      changedKeys.push({ _tag: 'added', pointer, newValue: rightValue })
      continue
    }

    if (rightValue === undefined) {
      changedKeys.push({ _tag: 'removed', pointer, oldValue: leftValue })
      continue
    }

    // If both are objects, recurse deeper
    if (isObject(leftValue) && isObject(rightValue)) {
      const nestedChanges = compareKeysRecursive(leftValue, rightValue, pointer)
      changedKeys.push(...nestedChanges)
    } else {
      // Either primitive values changed, or one is object and other is not
      changedKeys.push({
        _tag: 'modified',
        pointer,
        oldValue: leftValue,
        newValue: rightValue,
      })
    }
  }

  return changedKeys
}

function compareKeys(leftObj: JsonRecord, rightObj: JsonRecord): MetaChange[] {
  return compareKeysRecursive(leftObj, rightObj)
}

function getMetaChange(
  left: Revision,
  right: Revision,
): Extract<WhatChanged, { _tag: 'meta' }> | null {
  if (JSON.stringify(left.userMeta) === JSON.stringify(right.userMeta)) return null

  return {
    _tag: 'meta' as const,
    keys: compareKeys(left.userMeta || {}, right.userMeta || {}),
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
