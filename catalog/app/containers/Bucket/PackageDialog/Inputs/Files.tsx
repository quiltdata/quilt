import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import * as BucketPreferences from 'utils/BucketPreferences'

import type { FormStatus } from '../State/form'
import type { SchemaStatus } from '../State/schema'
import type { FilesState } from '../State/files'
import type { UploadTotalProgress } from '../Uploads'
import { FilesInputSkeleton } from '../Skeleton'

import { FilesInput } from './Files/Input'

const useInputFilesStyles = M.makeStyles((t) => ({
  root: {
    height: '100%',
    overflowY: 'auto',
  },
  error: {
    height: `calc(90% - ${t.spacing()}px)`,
  },
}))

interface InputFilesProps {
  delayHashing: boolean
  formStatus: FormStatus
  progress: UploadTotalProgress
  state: FilesState
}

const prependSourceBucket = (
  buckets: BucketPreferences.SourceBuckets,
  bucket: string,
): BucketPreferences.SourceBuckets =>
  buckets.list.find((b) => b === bucket)
    ? buckets
    : {
        getDefault: () => bucket,
        list: [bucket, ...buckets.list],
      }

function WithSourceBuckets({
  delayHashing,
  formStatus,
  progress,
  buckets,
  bucket,
  state: { initial, status, value, onChange },
}: InputFilesProps & {
  bucket: string
  buckets: BucketPreferences.SourceBuckets
}) {
  const classes = useInputFilesStyles()

  const sourceBuckets = React.useMemo(
    () => prependSourceBucket(buckets, bucket),
    [buckets, bucket],
  )

  return (
    <FilesInput
      className={cx(classes.root, { [classes.error]: status._tag === 'error' })}
      delayHashing={delayHashing}
      disabled={formStatus._tag === 'submitting' || formStatus._tag === 'success'}
      error={status._tag === 'error' ? status.error : undefined}
      errors={status._tag === 'error' ? status.errors : undefined}
      initial={initial}
      onChange={onChange}
      title="Files"
      totalProgress={progress}
      value={value}
      sourceBuckets={sourceBuckets}
    />
  )
}

export default function InputFiles({
  delayHashing,
  formStatus,
  progress,
  schema,
  state,
  bucket,
}: InputFilesProps & {
  schema: SchemaStatus
  bucket: string
}) {
  const classes = useInputFilesStyles()
  const { prefs } = BucketPreferences.use()

  if (schema._tag === 'loading') return <FilesInputSkeleton className={classes.root} />

  return BucketPreferences.Result.match(
    {
      Ok: ({ ui: { sourceBuckets: buckets } }) => (
        <WithSourceBuckets
          {...{
            delayHashing,
            formStatus,
            progress,
            state,
            buckets,
            bucket,
          }}
        />
      ),
      Pending: () => <FilesInputSkeleton className={classes.root} />,
      Init: () => null,
    },
    prefs,
  )
}
