import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

type WhatChanged = { _tag: 'meta'; keys: string[] }

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
          <M.Chip label={label} size="small" key={index} />
        ))}
      </span>
    </span>
  )
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

function getChanges(left: Revision, right: Revision): WhatChanged[] {
  const changes = []
  const userMeta = getMetaChange(left, right)
  if (userMeta) {
    changes.push(userMeta)
  }
  return changes
}

interface SummaryItemProps {
  change: WhatChanged
}

function SummaryItem({ change }: SummaryItemProps) {
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
