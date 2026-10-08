import * as React from 'react'
import * as RRDom from 'react-router-dom'

import type * as Model from 'model'
import { isQuickPreviewAvailable } from 'components/Preview/quick'
import * as BucketPreferences from 'utils/BucketPreferences'
import Log from 'utils/Logging'
import * as NamedRoutes from 'utils/NamedRoutes'
import * as PackageLock from 'utils/PackageLock'
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
              [packageHandle.path!]: encodeURI(s3paths.handleToS3Url(fileHandle)),
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

// Writable when bucket preferences allow it, and the package the file is added to, if
// any, is known unlocked.
function useWritable(add?: string) {
  const { prefs } = BucketPreferences.use()
  const pkg = React.useMemo(() => {
    try {
      return add ? PackageUri.parse(add) : null
    } catch {
      return undefined
    }
  }, [add])
  const unlocked =
    PackageLock.useLockStatus(pkg?.bucket ?? '', pkg?.name ?? '', !pkg) === 'unlocked'
  // A target with no lock to check, unparseable or pathless, must not pass as no target.
  if (pkg === undefined || (pkg && !pkg.path)) return false
  const allowed = BucketPreferences.Result.match(
    { Ok: ({ ui: { actions } }) => actions.writeFile, _: () => false },
    prefs,
  )
  return unlocked && allowed
}

export const LOCKED_OUT = "This package was locked; your changes can't be saved."

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
  writable: boolean
}

// TODO: use Provider
export function useState(handle: Model.S3.S3ObjectLocation): EditorState {
  const types = React.useMemo(() => detect(handle.key), [handle.key])
  const location = RRDom.useLocation()
  const { add, edit } = parseSearch(location.search, true)
  const writable = useWritable(add)
  const [error, setError] = React.useState<Error | null>(null)
  const [value, setValue] = React.useState<string | undefined>()
  const [editingState, setEditing] = React.useState<EditorInputType | null>(
    edit ? types[0] : null,
  )
  // An editor opened while writable stays open, read-only, if the package locks, so the
  // typed text isn't lost; one asked for by the URL waits until the package is writable.
  const opened = React.useRef(false)
  const editing = writable || opened.current ? editingState : null
  React.useEffect(() => {
    opened.current = !!editing
  }, [editing])
  const lockedOut = !!editing && !writable
  const shownError = React.useMemo(
    () => (lockedOut ? new Error(LOCKED_OUT) : error),
    [lockedOut, error],
  )
  const [preview, setPreview] = React.useState<boolean>(false)
  const [saving, setSaving] = React.useState<boolean>(false)
  const writeFile = useWriteData(handle)
  const redirect = useRedirect()
  const onSave = React.useCallback(async () => {
    if (!writable) return
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
  }, [redirect, value, writable, writeFile])
  const onCancel = React.useCallback(() => {
    setEditing(null)
    setError(null)
  }, [])
  return React.useMemo(
    () => ({
      editing,
      error: shownError,
      onCancel,
      onChange: setValue,
      onEdit: setEditing,
      onPreview: isQuickPreviewAvailable(editing) ? setPreview : null,
      onSave,
      preview,
      saving,
      types,
      value,
      writable,
    }),
    [editing, shownError, onCancel, onSave, preview, saving, types, value, writable],
  )
}
