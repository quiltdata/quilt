import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import Skeleton from 'components/Skeleton'

import type { Revision, RevisionsResult } from '../../useRevisionsPair'

import { compareJsonRecords } from '../compareJsons'

import SummaryEntry from './Entry'
import SummaryItem from './Item'
import UserMetadata from './UserMetadata'
import comparePackageEntries from './comparePackageEntries'

const useStyles = M.makeStyles((t) => ({
  empty: {
    ...t.typography.body2,
    color: t.palette.text.secondary,
  },
}))

interface SummaryDiffProps {
  revisions: [Revision, Revision]
}

function SummaryDiff({ revisions: [base, other] }: SummaryDiffProps) {
  const classes = useStyles()

  const metaChanges = React.useMemo(
    () => compareJsonRecords(base.userMeta || {}, other.userMeta || {}),
    [base, other],
  )
  const entryChanges = React.useMemo(() => {
    const baseData = base.contentsFlatMap
    const otherData = other.contentsFlatMap

    if (!baseData && !otherData) {
      return new Error(`Package manifests are too large`)
    }
    if (!baseData) {
      return new Error(`Package manifest ${base.hash} is too large`)
    }
    if (!otherData) {
      return new Error(`Package manifest ${other.hash} is too large`)
    }

    return comparePackageEntries(baseData, otherData)
  }, [base, other])

  if (metaChanges instanceof Error) {
    return <Lab.Alert severity="error">{metaChanges.message}</Lab.Alert>
  }
  if (entryChanges instanceof Error) {
    return <Lab.Alert severity="error">{entryChanges.message}</Lab.Alert>
  }

  if (metaChanges.length === 0 && entryChanges.length === 0) {
    return <p className={classes.empty}>Nothing changed</p>
  }

  return (
    <>
      {metaChanges.length && (
        <SummaryItem title="Package user metadata">
          <UserMetadata changes={metaChanges} />
        </SummaryItem>
      )}
      {entryChanges.map((change) => (
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
