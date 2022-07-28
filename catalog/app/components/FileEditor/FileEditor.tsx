import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import type { S3HandleBase } from 'utils/s3paths'

import Skeleton from './Skeleton'
import TextEditor from './TextEditor'
import { detect, loadMode, useWriteData } from './loader'
import { EditorInputType } from './types'

function useRedirect() {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  const { next } = parseSearch(location.search, true)
  return React.useCallback(
    ({ bucket, key, version }) =>
      history.push(next || urls.bucketFile(bucket, key, { version })),
    [history, next, urls],
  )
}

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
  const location = RRDom.useLocation()
  const { edit } = parseSearch(location.search, true)
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<boolean>(!!edit)
  const [saving, setSaving] = React.useState<boolean>(false)
  const writeFile = useWriteData(handle)
  const redirect = useRedirect()
  const onSave = React.useCallback(async () => {
    setSaving(true)
    const h = await writeFile(value || '') // TODO: Ask if user really wants to save empty file
    setEditing(false)
    setSaving(false)
    redirect(h)
  }, [redirect, value, writeFile])
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
