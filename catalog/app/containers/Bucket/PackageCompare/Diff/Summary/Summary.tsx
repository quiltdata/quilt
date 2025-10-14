import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'

import type { Revision, RevisionsResult } from '../../useRevisionsPair'

import { compareJsonRecords, type Change } from '../compareJsons'

import SummaryEntry from './Entry'
import SummaryItem from './Item'
import UserMetadata from './UserMetadata'
import comparePackageEntries, { type EntryChange } from './comparePackageEntries'

function getChanges([base, other]: [Revision, Revision]): {
  metaChanges: Change[]
  entriesChanges: EntryChange[]
} | null {
  const metaChanges = compareJsonRecords(base.userMeta || {}, other.userMeta || {})

  const baseData = base.contentsFlatMap
  const otherData = other.contentsFlatMap

  if (!baseData && !otherData) {
    throw new Error(`Package manifests are too large`)
  }
  if (!baseData) {
    throw new Error(`Package manifest ${base.hash} is too large`)
  }
  if (!otherData) {
    throw new Error(`Package manifest ${other.hash} is too large`)
  }

  const entriesChanges = comparePackageEntries(baseData, otherData)

  if (metaChanges instanceof Error) {
    throw metaChanges
  }
  if (entriesChanges instanceof Error) {
    throw entriesChanges
  }

  return metaChanges.length || entriesChanges.length
    ? { metaChanges, entriesChanges }
    : null
}

const useStyles = M.makeStyles((t) => ({
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

interface SummaryDiffProps {
  revisions: [Revision, Revision]
}

function SummaryDiff({ revisions }: SummaryDiffProps) {
  const classes = useStyles()

  const changes = React.useMemo(() => {
    try {
      return getChanges(revisions)
    } catch (e) {
      return e instanceof Error ? e : new Error(`Unexpected error: ${e}`)
    }
  }, [revisions])

  if (changes instanceof Error) {
    return <Lab.Alert severity="error">{changes.message}</Lab.Alert>
  }

  if (!changes) {
    return <p className={classes.empty}>Nothing changed</p>
  }

  const { metaChanges, entriesChanges } = changes
  return (
    <>
      {metaChanges.length && (
        <SummaryItem title="Package user metadata">
          <UserMetadata changes={metaChanges} />
        </SummaryItem>
      )}
      {entriesChanges.map((change) => (
        <SummaryEntry key={change.logicalKey} change={change} />
      ))}
    </>
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
