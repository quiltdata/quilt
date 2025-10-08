import { diffJson } from 'diff'
import * as React from 'react'
import * as M from '@material-ui/core'

import assertNever from 'utils/assertNever'
import Skeleton from 'components/Skeleton'

import type { Revision, RevisionResult } from '../useRevision'

import Change from './Change'
import type { Order } from './Change'

function getChanges(
  base: Revision,
  other: Revision,
  changesOnly: boolean = false,
): { order: Order; value: string }[] {
  const dir = base.modified > other.modified ? 'backward' : 'forward'
  return diffJson(base.userMeta || {}, other.userMeta || {})
    .map((c) => ({
      ...c,
      value: c.value
        .replace(/}/g, '')
        .replace(/{/g, '')
        .replace(/]/g, '')
        .replace(/]/g, ''),
    }))
    .filter((c) => c.value.trim())
    .filter((c) => !changesOnly || c.added || c.removed)
    .map((c) => {
      if (!c.added && !c.removed) return { order: { _tag: 'limbo' }, value: c.value }
      const hash = c.added ? other.hash : base.hash
      switch (dir) {
        case 'forward':
          return {
            order: {
              _tag: c.added ? 'latter' : 'former',
              hash,
            },
            value: c.value,
          }
        case 'backward':
          return {
            order: {
              _tag: c.added ? 'former' : 'latter',
              hash,
            },
            value: c.value,
          }
        default:
          assertNever(dir)
      }
    })
}

const useStyles = M.makeStyles((t) => ({
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: t.spacing(2),
  },
  change: {
    ...t.typography.monospace,
    borderRadius: 0,
    paddingBottom: t.spacing(0.5),
    paddingTop: t.spacing(0.5),
    whiteSpace: 'pre-wrap',
  },
}))

interface MetadataDiffProps {
  base: Revision
  other: Revision
  changesOnly?: boolean
}

function MetadataDiff({
  base,
  other,
  changesOnly: changesOnly = false,
}: MetadataDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(
    () => getChanges(base, other, changesOnly),
    [base, other, changesOnly],
  )

  if (changes.length === 0) {
    return (
      <M.Typography variant="body2" color="textSecondary" className={classes.empty}>
        Metadata is identical
      </M.Typography>
    )
  }

  return (
    <div>
      {changes.map(({ order, value }, index) => (
        <Change order={order} key={index} className={classes.change}>
          {value}
        </Change>
      ))}
    </div>
  )
}

interface MetadataDiffHandlerProps {
  base: RevisionResult
  other: RevisionResult
  changesOnly?: boolean
}

export default function MetadataDiffHandler({
  base,
  other,
  changesOnly,
}: MetadataDiffHandlerProps) {
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

  return (
    <MetadataDiff base={base.revision} other={other.revision} changesOnly={changesOnly} />
  )
}
