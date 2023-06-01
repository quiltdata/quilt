import * as React from 'react'

import { L } from 'components/Form/Package/types'

import { FilesAction, FilesInput } from '../PackageDialog/FilesInput'

import { StagedFilesSkeleton } from './StagedFiles'
import * as State from './State'

export default function LegacyFilesWorkspace() {
  const { bucket, files, main, src } = State.use()
  const { uploads } = main.state
  const input = React.useMemo(() => {
    if (files.state === L || files.state.staged.map === L) return L
    return {
      value: files.state.staged.map,
      onChange: files.actions.staged.onMapChange,
    }
  }, [files.state, files.actions.staged.onMapChange])
  const successors = React.useMemo(() => {
    if (bucket.state.successors === L || bucket.state.successors instanceof Error)
      return []
    return bucket.state.successors.map(({ name }) => name)
  }, [bucket.state.successors])
  const meta = React.useMemo(() => {
    if (input == L) {
      return { initial: { added: {}, deleted: {}, existing: {} }, submitting: false }
    }
    return { initial: input.value, submitting: main.state.submitting }
  }, [input, main.state])
  const validationErrors = React.useMemo(() => {
    if (files.state === L) return null
    const { errors } = files.state.staged
    if (errors === L || !errors) return null
    return errors
  }, [files.state])

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

  if (input === L) return <StagedFilesSkeleton />

  return (
    <FilesInput
      bucket={src.bucket}
      buckets={successors}
      input={input}
      meta={meta}
      onFilesAction={onFilesAction}
      title="Files"
      totalProgress={uploads.progress}
      validationErrors={validationErrors}
    />
  )
}
