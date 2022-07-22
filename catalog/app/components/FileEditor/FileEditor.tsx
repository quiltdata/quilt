import * as React from 'react'
import { useLocation } from 'react-router-dom'

import AsyncResult from 'utils/AsyncResult'
import parseSearch from 'utils/parseSearch'
import type { S3HandleBase } from 'utils/s3paths'
import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'

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
  const writeFile = useWriteData(handle)
  const onSave = React.useCallback(async () => {
    await writeFile(value)
    setEditing(false)
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
      type,
      value,
    }),
    [editing, onCancel, onEdit, onSave, type, value],
  )
}

interface EditorProps {
  empty?: boolean
  handle: S3HandleBase
  onChange: (value: string) => void
  type: EditorInputType
}

function EditorSuspended({ empty, handle, onChange, type }: EditorProps) {
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
      return <TextEditor type={type} value={value} onChange={onChange} />
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
