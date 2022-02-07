import * as React from 'react'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'

import { JsonValue } from 'components/JsonEditor/constants'
import * as IPC from 'utils/electron/ipc-provider'
import { JsonSchema } from 'utils/json-schema'
import * as workflows from 'utils/workflows'
import { getMetaValue, getWorkflowApiParam } from 'containers/Bucket/requests/package'

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

interface LocalFolderInputProps {
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
}

export function LocalFolderInput({
  input: { onChange, value },
  meta,
}: LocalFolderInputProps) {
  const ipc = IPC.use()

  const disabled = React.useMemo(() => meta.submitting || meta.submitSucceeded, [meta])
  const handleClick = React.useCallback(async () => {
    if (disabled) return
    const newLocalPath = await ipc.invoke(IPC.EVENTS.LOCALPATH_REQUEST)
    if (!newLocalPath) return
    onChange(newLocalPath)
  }, [disabled, ipc, onChange])

  return (
    <M.TextField
      InputLabelProps={{ shrink: true }}
      disabled={disabled}
      fullWidth
      id="localPath"
      label="Path to local folder"
      margin="normal"
      onClick={handleClick}
      placeholder="Click to set local folder with your file browser"
      size="small"
      value={value}
    />
  )
}
