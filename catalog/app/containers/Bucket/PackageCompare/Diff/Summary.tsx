import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'

import type { Revision, RevisionResult } from '../useRevision'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getChanges(_left: Revision, _right: Revision): any[] {
  return []
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

  return <div>{/* TODO: Implement summary changes display */}</div>
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
