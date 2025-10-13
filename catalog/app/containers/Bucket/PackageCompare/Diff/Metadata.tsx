import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import Skeleton from 'components/Skeleton'
import assertNever from 'utils/assertNever'

import type { Revision, RevisionsResult } from '../useRevisionsPair'

import Revisioned from './Revisioned'
import diffJsons from './diffJsons'
import useColors from './useColors'

type Change =
  | { _tag: 'added'; hash: string; value: string }
  | { _tag: 'removed'; hash: string; value: string }
  | { _tag: 'unmodified'; value: string }

const useStyles = M.makeStyles((t) => ({
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
  change: {
    ...t.typography.monospace,
    paddingBottom: t.spacing(0.75),
    paddingLeft: t.spacing(2),
    paddingTop: t.spacing(0.75),
    whiteSpace: 'pre-wrap',
  },
}))

interface MetadataDiffProps {
  revisions: [Revision, Revision]
  changesOnly?: boolean
}

function MetadataDiff({
  revisions: [base, other],
  changesOnly: changesOnly = false,
}: MetadataDiffProps) {
  const colors = useColors()
  const classes = useStyles()

  const changes: Change[] = React.useMemo(
    () =>
      diffJsons(base.userMeta, other.userMeta, changesOnly).map((c) => {
        switch (c._tag) {
          case 'added':
            return { ...c, hash: other.hash }
          case 'removed':
            return { ...c, hash: base.hash }
          case 'unmodified':
            return c
          default:
            assertNever(c)
        }
      }),
    [base, other, changesOnly],
  )

  if (changes.length === 0) {
    return <p className={classes.empty}>Metadata unchanged</p>
  }

  return (
    <M.Paper square variant="outlined">
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
    </M.Paper>
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
