import cx from 'classnames'
import { diffJson } from 'diff'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

import type { Revision, RevisionsResult } from '../useRevisionsPair'

import useColors from './useColors'
import Revisioned from './Revisioned'

type Change =
  | { _tag: 'added'; hash: string; value: string }
  | { _tag: 'removed'; hash: string; value: string }
  | { _tag: 'unmodified'; value: string }

// We believe showing braces frighten wet scientists
function removeBraces(input: string) {
  return input.replace(/}/g, '').replace(/{/g, '').replace(/]/g, '').replace(/]/g, '')
}

function getChanges(
  [base, other]: [Revision, Revision],
  changesOnly: boolean = false,
): Change[] {
  return diffJson(base.userMeta || {}, other.userMeta || {})
    .map((c) => ({ ...c, value: removeBraces(c.value) }))
    .filter((c) => c.value.trim())
    .filter((c) => !changesOnly || c.added || c.removed)
    .map((c) => {
      if (c.added) return { _tag: 'added', hash: other.hash, value: c.value }
      if (c.removed) return { _tag: 'removed', hash: base.hash, value: c.value }
      return { _tag: 'unmodified', value: c.value }
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
  revisions: [Revision, Revision]
  changesOnly?: boolean
}

function MetadataDiff({
  revisions,
  changesOnly: changesOnly = false,
}: MetadataDiffProps) {
  const colors = useColors()
  const classes = useStyles()

  const changes = React.useMemo(
    () => getChanges(revisions, changesOnly),
    [revisions, changesOnly],
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
      {changes.map((change, index) =>
        change._tag === 'unmodified' ? (
          <div key={index} className={classes.change}>
            {change.value}
          </div>
        ) : (
          <Revisioned
            className={cx(classes.change, colors[change._tag])}
            hash={change.hash}
            key={index}
          >
            {change.value}
          </Revisioned>
        ),
      )}
    </div>
  )
}

interface MetadataDiffHandlerProps {
  revisionsResult: RevisionsResult
  changesOnly?: boolean
}

export default function MetadataDiffHandler({
  revisionsResult,
  changesOnly,
}: MetadataDiffHandlerProps) {
  if (revisionsResult._tag === 'loading') {
    return <Skeleton width="100%" height={200} />
  }

  if (revisionsResult._tag === 'error') {
    return (
      <M.Typography variant="body2" color="error">
        Error loading revisions
      </M.Typography>
    )
  }

  return <MetadataDiff revisions={revisionsResult.revisions} changesOnly={changesOnly} />
}
