import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type * as Model from 'model'
import { isQuickPreviewAvailable } from 'components/Preview/quick'
import Log from 'utils/Logging'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageUri from 'utils/PackageUri'
import parseSearch from 'utils/parseSearch'
import * as s3paths from 'utils/s3paths'

import { detect, useWriteData } from './loader'
import { EditorInputType } from './types'

function useRedirect() {
  const history = RRDom.useHistory()
  const { urls } = NamedRoutes.use()
  const location = RRDom.useLocation()
  // TODO: put this into FileEditor/routes

  const getRedirectRoute = React.useCallback(
    (fileHandle: Model.S3File) => {
      const { add, next } = parseSearch(location.search, true)
      if (next) return next

      if (add) {
        try {
          const packageHandle = PackageUri.parse(add)
          if (packageHandle.path) {
            return urls.bucketPackageAddFiles(packageHandle.bucket, packageHandle.name, {
              [packageHandle.path!]: s3paths.handleToS3Url(fileHandle),
            })
          }
          throw new Error('"add" parameter must contain `PackageUri` with "path"')
        } catch (error) {
          Log.error(error)
        }
      }

      const { bucket, key, version } = fileHandle
      return urls.bucketFile(bucket, key, { version })
    },
    [location.search, urls],
  )
  return React.useCallback(
    (file: Model.S3File) => history.push(getRedirectRoute(file)),
    [history, getRedirectRoute],
  )
}

export interface EditorState {
  editing: EditorInputType | null
  error: Error | null
  onCancel: () => void
  onChange: (value: string) => void
  onEdit: (type: EditorInputType | null) => void
  onPreview: ((p: boolean) => void) | null
  onSave: () => Promise<Model.S3File | void>
  preview: boolean
  saving: boolean
  types: EditorInputType[]
  value?: string
}

// TODO: use Provider
export function useState(handle: Model.S3.S3ObjectLocation): EditorState {
  const types = React.useMemo(() => detect(handle.key), [handle.key])
  const location = RRDom.useLocation()
  const { edit } = parseSearch(location.search, true)
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState<string | undefined>()
  const [editing, setEditing] = React.useState<EditorInputType | null>(
    edit ? types[0] : null,
  )
  const [preview, setPreview] = React.useState<boolean>(false)
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
      onPreview: isQuickPreviewAvailable(editing) ? setPreview : null,
      onSave,
      preview,
      saving,
      types,
      value,
    }),
    [editing, error, onCancel, onSave, preview, saving, types, value],
  )
}
