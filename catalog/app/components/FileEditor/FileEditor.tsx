import * as React from 'react'
import { useLocation } from 'react-router-dom'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import AsyncResult from 'utils/AsyncResult'
import parseSearch from 'utils/parseSearch'
import type { S3HandleBase } from 'utils/s3paths'
import wait from 'utils/wait'

import Skeleton from './Skeleton'
import TextEditor from './TextEditor'
import { EditorInputType } from './types'
import { detect, loadMode, useWriteData } from './loader'

interface EditorState {
  editing: boolean
  onCancel: () => void
  onChange: (value: string) => void
  onEdit: () => void
  onSave: () => Promise<void>
  type: EditorInputType
  value?: string
}

// TODO: use Provider
export function useState(handle: S3HandleBase): EditorState {
  const type = React.useMemo(() => detect(handle.key), [handle.key])
  const location = useLocation()
  const { edit } = parseSearch(location.search, true)
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<boolean>(!!edit)
  const [saving, setSaving] = React.useState<boolean>(false)
  const writeFile = useWriteData(handle)
  const onSave = React.useCallback(async () => {
    setSaving(true)
    await writeFile(value)
    await wait(300)
    setEditing(false)
    setSaving(false)
  }, [value, writeFile])
  const onCancel = React.useCallback(() => setEditing(false), [])
  const onEdit = React.useCallback(() => setEditing(true), [])
  return React.useMemo(
    () => ({
      editing,
      onCancel,
      onChange: setValue,
      onEdit,
      onSave,
      saving,
      type,
      value,
    }),
    [editing, onCancel, onEdit, onSave, saving, type, value],
  )
}

interface EditorProps {
  disabled?: boolean
  empty?: boolean
  handle: S3HandleBase
  onChange: (value: string) => void
  type: EditorInputType
}

function EditorSuspended({ disabled, empty, handle, onChange, type }: EditorProps) {
  loadMode(type.brace || 'text')

  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  if (empty) return <TextEditor type={type} value="" onChange={onChange} />
  return data.case({
    _: () => <Skeleton />,
    Err: (
      err: $TSFixMe, // PreviewError
    ) => (
      <div>
        {/* @ts-expect-error */}
        <PreviewDisplay data={AsyncResult.Err(err)} />
      </div>
    ),
    Ok: (response: $TSFixMe) => {
      const value = response.Body.toString('utf-8')
      return (
        <TextEditor disabled={disabled} type={type} value={value} onChange={onChange} />
      )
    },
  })
}

export function Editor(props: EditorProps) {
  return (
    <React.Suspense fallback={<Skeleton />}>
      <EditorSuspended {...props} />
    </React.Suspense>
  )
}
