import * as React from 'react'
import * as RRDom from 'react-router-dom'

import * as PreviewUtils from 'components/Preview/loaders/utils'
import PreviewDisplay from 'components/Preview/Display'
import type * as Model from 'model'
import * as AddToPackage from 'containers/AddToPackage'
import AsyncResult from 'utils/AsyncResult'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import type { S3HandleBase } from 'utils/s3paths'

import Skeleton from './Skeleton'
import TextEditor from './TextEditor'
import { detect, loadMode, useWriteData } from './loader'
import { EditorInputType } from './types'

export { detect, isSupportedFileType } from './loader'

function useRedirect() {
  const addToPackage = AddToPackage.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  const { add, next } = parseSearch(location.search, true)
  return React.useCallback(
    ({ bucket, key, size, version }: Model.S3File) => {
      if (add && addToPackage?.append) {
        addToPackage.append({ bucket, key, size, version })
      }
      history.push(next || urls.bucketFile(bucket, key, { version }))
    },
    [history, next, addToPackage, add, urls],
  )
}

interface EditorState {
  editing: boolean
  error: Error | null
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
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<boolean>(!!edit)
  const [saving, setSaving] = React.useState<boolean>(false)
  const writeFile = useWriteData(handle)
  const redirect = useRedirect()
  const onSave = React.useCallback(async () => {
    // XXX: implement custom MUI Dialog-based confirm?
    // eslint-disable-next-line no-restricted-globals, no-alert
    if (!value && !window.confirm('You are about to save empty file')) return
    setSaving(true)
    try {
      setError(null)
      const h = await writeFile(value || '')
      setEditing(false)
      setSaving(false)
      redirect(h)
    } catch (e) {
      setError(e instanceof Error ? e : new Error(`${e}`))
      setSaving(false)
    }
  }, [redirect, value, writeFile])
  const onCancel = React.useCallback(() => {
    setEditing(false)
    setError(null)
  }, [])
  const onEdit = React.useCallback(() => setEditing(true), [])
  return React.useMemo(
    () => ({
      editing,
      error,
      onCancel,
      onChange: setValue,
      onEdit,
      onSave,
      saving,
      type,
      value,
    }),
    [editing, error, onCancel, onEdit, onSave, saving, type, value],
  )
}

interface EditorProps {
  disabled?: boolean
  empty?: boolean
  error: Error | null
  handle: S3HandleBase
  onChange: (value: string) => void
  type: EditorInputType
}

function EditorSuspended({
  disabled,
  empty,
  error,
  handle,
  onChange,
  type,
}: EditorProps) {
  loadMode(type.brace || 'text')

  const data = PreviewUtils.useObjectGetter(handle, { noAutoFetch: empty })
  if (empty) return <TextEditor error={error} type={type} value="" onChange={onChange} />
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
        <TextEditor
          disabled={disabled}
          error={error}
          onChange={onChange}
          type={type}
          value={value}
        />
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
