import { basename } from 'path'

import * as React from 'react'
import { DropEvent, useDropzone } from 'react-dropzone'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import { JsonValue } from 'components/JsonEditor/constants'
import useDragging from 'utils/dragging'
import * as IPC from 'utils/electron/ipc-provider'
import { JsonSchema } from 'utils/json-schema'
import * as workflows from 'utils/workflows'
import { getMetaValue, getWorkflowApiParam } from 'containers/Bucket/requests/package'

import * as FI from './PackageDialog/FilesInput'

interface UploadPackagePayload {
  message: string
  meta: JsonValue
  workflow: workflows.Workflow
  entry: string
}

interface UploadPackageTarget {
  bucket: string
  name: string
}

export function useUploadPackage() {
  const ipc = IPC.use()
  return React.useCallback(
    (payload: UploadPackagePayload, target: UploadPackageTarget, schema?: JsonSchema) => {
      const body = {
        ...payload,
        meta: getMetaValue(payload.meta, schema),
        workflow: getWorkflowApiParam(payload.workflow.slug),
      }
      return ipc.invoke(IPC.EVENTS.UPLOAD_PACKAGE, body, target)
    },
    [ipc],
  )
}

function isDroppedDirectory(event: DropEvent) {
  try {
    // @ts-expect-error DropEvent type is incorrect
    const dt = event.dataTransfer
    const entry = dt.items[0].webkitGetAsEntry()
    return entry.isDirectory
  } catch (error) {
    return false
  }
}

function getFilesFromEvent(event: DropEvent) {
  if (isDroppedDirectory(event)) {
    console.log('it IS directory')
    // @ts-expect-error DropEvent type is incorrect
    return Promise.resolve([event.dataTransfer.files[0]])
  }
  return Promise.resolve([])
}

const useLocalFolderInputStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexDirection: 'column',
    flexGrow: 1,
    marginTop: t.spacing(2),
    overflowY: 'auto',
    position: 'relative',
  },
  outlined: {
    outline: `2px dashed ${t.palette.primary.light}`,
    outlineOffset: '-2px',
  },
}))

interface LocalFolderInputProps {
  className?: string
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
  errors: $TSFixMe
}

export function LocalFolderInput({
  className,
  input: { onChange, value },
  meta,
  errors,
}: LocalFolderInputProps) {
  const ipc = IPC.use()

  const classes = useLocalFolderInputStyles()

  const submitting = meta.submitting || meta.submitSucceeded
  const error = meta.submitFailed && meta.error

  const disabled = React.useMemo(() => meta.submitting || meta.submitSucceeded, [meta])
  const handleClick = React.useCallback(async () => {
    if (disabled) return
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [disabled, ipc, onChange])

  const onDrop = React.useCallback((files) => onChange(files[0].path), [onChange])

  const isDragging = useDragging()
  const { getRootProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    getFilesFromEvent,
    maxFiles: 1,
  })

  return (
    <FI.ContentsContainer className={className} outlined={isDragging}>
      <FI.Contents
        {...getRootProps({ onClick: handleClick })}
        active={isDragActive}
        error={!!error}
      >
        <FI.FilesContainer error={error}>
          {value && <FI.Dir name={basename(value)} />}
        </FI.FilesContainer>
        <FI.DropzoneMessage
          label="Drop directory or click to browse"
          error={error && (errors[error] || error)}
          warn={{ upload: false, s3: false, count: false }}
        />
        {submitting && <FI.Lock />}
      </FI.Contents>
    </FI.ContentsContainer>
  )
}
