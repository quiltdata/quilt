import * as React from 'react'

import { L } from 'components/Form/Package/types'
import type { BucketConfig } from 'components/Form/Package/DestinationBucket'

import { FilesAction, FilesInput } from '../PackageDialog/FilesInput'
import type { EntriesValidationErrors } from '../PackageDialog/PackageDialog'
import { FilesInputSkeleton } from '../PackageDialog/Skeleton'

import * as State from './State'
import type { FS, Uploads } from './State/Files'

interface LegacyFilesWorkspaceProps {
  bucket: string
  errors?: EntriesValidationErrors | typeof L
  onChange: (v: FS) => void
  submitting: boolean
  successors: BucketConfig[] | Error
  uploads: Uploads
  value: FS
}

function LegacyFilesWorkspace({
  bucket,
  errors,
  onChange,
  submitting,
  successors,
  uploads,
  value,
}: LegacyFilesWorkspaceProps) {
  const input = React.useMemo(
    () => ({
      value,
      onChange,
    }),
    [value, onChange],
  )
  const buckets = React.useMemo(() => {
    if (successors instanceof Error) return []
    return successors.map(({ name }) => name)
  }, [successors])
  const meta = React.useMemo(
    () => ({ initial: input.value, submitting }),
    [input, submitting],
  )
  const validationErrors = React.useMemo(() => {
    if (errors === L || !errors) return null
    return errors
  }, [errors])

  const onFilesAction = React.useMemo(
    () =>
      FilesAction.match({
        _: () => {},
        Revert: uploads.remove,
        RevertDir: uploads.removeByPrefix,
        Reset: uploads.reset,
      }),
    [uploads],
  )

  return (
    <FilesInput
      bucket={bucket}
      buckets={buckets}
      input={input}
      meta={meta}
      onFilesAction={onFilesAction}
      title="Files"
      totalProgress={uploads.progress}
      validationErrors={validationErrors}
    />
  )
}

export default function LegacyFilesWorkspaceContainer() {
  const { bucket, files, main, src } = State.use()
  if (files.state === L || files.state.value === L || bucket.state.successors === L) {
    return <FilesInputSkeleton />
  }
  return (
    <LegacyFilesWorkspace
      bucket={src.bucket}
      value={files.state.value}
      successors={bucket.state.successors}
      onChange={files.actions.onMapChange}
      submitting={main.state.status === L}
      errors={files.state.errors}
      uploads={files.state.uploads}
    />
  )
}
