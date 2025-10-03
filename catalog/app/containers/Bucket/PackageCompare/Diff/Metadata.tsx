import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'
import { diffJson, ChangeObject } from 'diff'

import assertNever from 'utils/assertNever'
import Skeleton from 'components/Skeleton'

import type { Revision, RevisionResult } from '../useRevision'

import Change from './Change'
import type { Dir } from './Change'
import GridRow from './GridRow'

interface MetadataDiffProps {
  left: RevisionResult
  right: RevisionResult
}

interface ChangeLineProps {
  change: ChangeObject<string>
  dir: Dir
}

function ChangeLine({ change: { added, removed, value }, dir }: ChangeLineProps) {
  const order = React.useMemo(() => {
    if (!added && !removed) return 'limbo'
    switch (dir) {
      case 'forward':
        if (added) return 'latter'
        return 'former'
      case 'backward':
        if (added) return 'former'
        return 'latter'
      default:
        assertNever(dir)
    }
  }, [added, removed, dir])
  return (
    <Change order={order}>
      <pre>{value}</pre>
    </Change>
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
}))

function MetadataDiffComponent({ left, right }: { left: Revision; right: Revision }) {
  const classes = useStyles()

  const dir: Dir = React.useMemo(
    () => (left.modified > right.modified ? 'backward' : 'forward'),
    [left.modified, right.modified],
  )

  const changes = React.useMemo(
    () => diffJson(left.userMeta || {}, right.userMeta || {}),
    [left.userMeta, right.userMeta],
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
      <GridRow className={cx(classes.row, classes.head)} dense divided>
        {left.hash}
        {right.hash}
      </GridRow>
      {changes.map((change, index) => (
        <ChangeLine key={index} change={change} dir={dir} />
      ))}
    </div>
  )
}

export default function MetadataDiff({ left: left, right: right }: MetadataDiffProps) {
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

  return <MetadataDiffComponent left={left.revision} right={right.revision} />
}
