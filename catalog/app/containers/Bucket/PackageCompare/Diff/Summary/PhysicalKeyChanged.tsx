import cx from 'classnames'
import { diffWords } from 'diff'
import * as React from 'react'
import * as M from '@material-ui/core'

import useColors from '../useColors'
import type { ChangePhysicalKey } from './comparePackageEntries'

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
  const colors = useColors()
  const diff = React.useMemo(() => diffWords(base, other), [base, other])
  return (
    <>
      {diff.map((part, index) => {
        if (part.removed) {
          return (
            <span key={index} className={cx(colors.removed, colors.inline)}>
              {part.value}
            </span>
          )
        }
        if (part.added) {
          return (
            <span key={index}>
              {diff[index - 1]?.removed ? <> → </> : <></>}
              <span className={cx(colors.added, colors.inline)}>{part.value}</span>
            </span>
          )
        }
        return <span key={index}>{part.value}</span>
      })}
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
