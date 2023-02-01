import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type * as Model from 'model'
import * as AddToPackage from 'containers/AddToPackage'
import * as NamedRoutes from 'utils/NamedRoutes'
import parseSearch from 'utils/parseSearch'
import type { S3HandleBase } from 'utils/s3paths'

import { detect, useWriteData } from './loader'
import { EditorInputType } from './types'

function useRedirect() {
  const addToPackage = AddToPackage.use()
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  const { add, next } = parseSearch(location.search, true)
  return React.useCallback(
    ({ bucket, key, size, version }: Model.S3File) => {
      if (add && addToPackage?.append) {
        addToPackage.append(add, { bucket, key, size, version })
      }
      history.push(next || urls.bucketFile(bucket, key, { version }))
    },
    [history, next, addToPackage, add, urls],
  )
}

export interface EditorState {
  editing: EditorInputType | null
  error: Error | null
  onCancel: () => void
  onChange: (value: string) => void
  onEdit: (type: EditorInputType | null) => void
  onSave: () => Promise<Model.S3File | void>
  saving: boolean
  types: EditorInputType[]
  value?: string
}

// TODO: use Provider
export function useState(handle: S3HandleBase): EditorState {
  const types = React.useMemo(() => detect(handle.key), [handle.key])
  const location = RRDom.useLocation()
  const { edit } = parseSearch(location.search, true)
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<EditorInputType | null>(
    edit ? types[0] : null,
  )
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
      setEditing(null)
      setSaving(false)
      redirect(h)
      return h
    } catch (e) {
      const err = e instanceof Error ? e : new Error(`${e}`)
      setError(err)
      setSaving(false)
    }
  }, [redirect, value, writeFile])
  const onCancel = React.useCallback(() => {
    setEditing(null)
    setError(null)
  }, [])
  return React.useMemo(
    () => ({
      editing,
      error,
      onCancel,
      onChange: setValue,
      onEdit: setEditing,
      onSave,
      saving,
      types,
      value,
    }),
    [editing, error, onCancel, onSave, saving, types, value],
  )
}
