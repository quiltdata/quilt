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
  baseObj: JsonRecord,
  otherObj: JsonRecord,
  prefix: JSONPointer.Path = [],
): MetaChange[] {
  const changedKeys: MetaChange[] = []
  const combinedKeys = Object.keys({ ...baseObj, ...otherObj })

  for (const key of combinedKeys) {
    const pointer = prefix.length ? [...prefix, key] : [key]
    const baseValue = baseObj[key]
    const otherValue = otherObj[key]

    // If values are strictly equal, no change
    if (baseValue === otherValue) {
      continue
    }

    // Handle missing keys
    if (baseValue === undefined) {
      changedKeys.push({ _tag: 'added', pointer, newValue: otherValue })
      continue
    }

    if (otherValue === undefined) {
      changedKeys.push({ _tag: 'removed', pointer, oldValue: baseValue })
      continue
    }

    // If both are objects, recurse deeper
    if (isObject(baseValue) && isObject(otherValue)) {
      const nestedChanges = compareKeysRecursive(baseValue, otherValue, pointer)
      changedKeys.push(...nestedChanges)
    } else {
      // Either primitive values changed, or one is object and other is not
      changedKeys.push({
        _tag: 'modified',
        pointer,
        oldValue: baseValue,
        newValue: otherValue,
      })
    }
  }

  return changedKeys
}

function compareKeys(baseObj: JsonRecord, otherObj: JsonRecord): MetaChange[] {
  return compareKeysRecursive(baseObj, otherObj)
}

function getMetaChange(
  base: Revision,
  other: Revision,
): Extract<WhatChanged, { _tag: 'meta' }> | null {
  if (JSON.stringify(base.userMeta) === JSON.stringify(other.userMeta)) return null

  return {
    _tag: 'meta' as const,
    keys: compareKeys(base.userMeta || {}, other.userMeta || {}),
  }
}

function getEntryChanges(base: Revision, other: Revision): WhatChanged[] {
  const baseData = base.contentsFlatMap || {}
  const otherData = other.contentsFlatMap || {}
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
      const metaChanged =
        JSON.stringify(baseEntry.meta) !== JSON.stringify(otherEntry.meta)

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

function getChanges(base: Revision, other: Revision): WhatChanged[] {
  return [getMetaChange(base, other), ...getEntryChanges(base, other)].filter(
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
  base: Revision
  other: Revision
}

function SummaryDiff({ base, other }: SummaryDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(() => getChanges(base, other), [base, other])

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
  base: RevisionResult
  other: RevisionResult
}

export default function SummaryDiffHandler({ base, other }: SummaryDiffHandlerProps) {
  if (base._tag === 'loading' || other._tag === 'loading') {
    return <Skeleton width="100%" height={200} />
  }

  if (base._tag === 'error' || other._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return <SummaryDiff base={base.revision} other={other.revision} />
}
