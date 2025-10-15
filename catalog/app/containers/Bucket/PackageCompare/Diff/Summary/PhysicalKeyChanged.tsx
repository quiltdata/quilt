import * as React from 'react'
import * as M from '@material-ui/core'

import type { ChangePhysicalKey } from './comparePackageEntries'
import comparePaths from './comparePaths'

import FromTo from './FromTo'

interface UrlPartChangedProps {
  changes: [string, string]
}

function BucketChanged({ changes }: UrlPartChangedProps) {
  const bucketsWithS3 = React.useMemo(
    () => changes.map((b) => `s3://${b}`) as [string, string],
    [changes],
  )
  return <FromTo changes={bucketsWithS3} />
}

function KeyChanged({ changes: [base, other] }: UrlPartChangedProps) {
  const comparison = React.useMemo(() => comparePaths(base, other), [base, other])
  if (!comparison) return <span>{base}</span>
  return (
    <>
      {comparison.head && <span>{comparison.head}</span>}
      <FromTo changes={comparison.changes} />
      {comparison.tail && <span>{comparison.tail}</span>}
    </>
  )
}

const useStyles = M.makeStyles((t) => ({
  url: {
    ...t.typography.monospace,
  },
}))

interface PhysicalKeyChangedProps {
  physicalKey: NonNullable<ChangePhysicalKey>
  ignoreVersionChange: boolean
}

export default function PhysicalKeyChanged({
  ignoreVersionChange,
  physicalKey,
}: PhysicalKeyChangedProps) {
  const classes = useStyles()
  const { bucket, key } = physicalKey
  if (Array.isArray(bucket) || Array.isArray(key)) {
    return (
      <>
        {'S3 object moved: '}
        <span className={classes.url}>
          {Array.isArray(bucket) ? <BucketChanged changes={bucket} /> : `s3://${bucket}`}/
          {Array.isArray(key) ? <KeyChanged changes={key} /> : key}
        </span>
      </>
    )
  }
  return !ignoreVersionChange ? <>S3 object version changed</> : null
}
