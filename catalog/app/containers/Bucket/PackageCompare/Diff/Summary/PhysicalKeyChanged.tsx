import cx from 'classnames'
import { diffWords } from 'diff'
import * as React from 'react'
import * as M from '@material-ui/core'

import useColors from '../useColors'
import type { ChangePhysicalKey } from './comparePackageEntries'

import FromTo from './FromTo'

interface KeyChangedProps {
  changes: [string, string]
}

function KeyChanged({ changes: [base, other] }: KeyChangedProps) {
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
              <span className={cx(colors.removed, colors.inline)}>{part.value}</span>
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
  const { bucket, key, version } = physicalKey
  if (Array.isArray(bucket) && Array.isArray(key.length)) {
    return (
      <>
        {'S3 object moved: '}
        <span className={classes.url}>
          s3://
          {Array.isArray(bucket) ? <FromTo changes={bucket} /> : bucket}
          {Array.isArray(key) ? <KeyChanged changes={key} /> : key}
          {version && (
            <>
              ?version={Array.isArray(version) ? <FromTo changes={version} /> : version}
            </>
          )}
        </span>
      </>
    )
  }
  return !ignoreVersionChange ? <>S3 object version changed</> : null
}
