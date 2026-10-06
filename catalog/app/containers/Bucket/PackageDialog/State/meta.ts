import type { ErrorObject } from 'ajv'
import * as React from 'react'

import { useFeature } from 'utils/features'
import * as Types from 'utils/types'

import type { FormStatus } from './form'
import { SchemaStatus, mkMetaValidator } from './schema'
import { ManifestStatus } from './manifest'

export type MetaStatus =
  | { _tag: 'error'; errors: (Error | ErrorObject)[] }
  | { _tag: 'ok' }

export const Err = (errors: Error | ErrorObject | (Error | ErrorObject)[]) => ({
  _tag: 'error' as const,
  errors: Array.isArray(errors) ? errors : [errors],
})

export const Ok = { _tag: 'ok' as const }

export interface MetaState {
  onChange: (m: Types.JsonRecord) => void
  status: MetaStatus
  value: Types.JsonRecord | undefined
  /** The `guided-metadata` preview: validate as the user types, not on submit. */
  guided: boolean
  /** The user has edited metadata in this dialog. */
  touched: boolean
}

function getMetaFallback(manifest: ManifestStatus) {
  if (manifest._tag !== 'ready') return undefined
  return manifest.manifest?.meta
}

export function useMeta(
  form: FormStatus,
  schema: SchemaStatus,
  manifest: ManifestStatus,
): MetaState {
  const guided = useFeature('guided-metadata')
  const [meta, setMeta] = React.useState<Types.JsonRecord>()
  // The form status current at the last edit: a server rejection only stands
  // until the metadata is edited after it.
  const [editedAt, setEditedAt] = React.useState<FormStatus>()
  const onChange = React.useCallback(
    (m: Types.JsonRecord) => {
      setMeta(m)
      setEditedAt(form)
    },
    [form],
  )
  const value = React.useMemo(() => meta || getMetaFallback(manifest), [manifest, meta])

  const validate = React.useMemo(() => {
    if (schema._tag === 'error') return () => [schema.error]
    if (schema._tag !== 'ready') return () => [new Error('Schema is not ready')]
    return mkMetaValidator(schema.schema)
  }, [schema])

  const status: MetaStatus = React.useMemo(() => {
    if (guided) {
      if (form._tag === 'error' && form.fields?.userMeta && editedAt !== form) {
        return Err(form.fields.userMeta)
      }
      // `value`, not `meta`: a revision keeps the manifest's metadata until edited,
      // and that is what gets pushed. Failing here also stops the submit before
      // any file is uploaded.
      const errors = validate(value || {})
      return errors ? Err(errors) : Ok
    }
    if (form._tag !== 'error') return Ok
    if (form.fields?.userMeta) return Err(form.fields.userMeta)

    const errors = validate(meta || {})
    return errors ? Err(errors) : Ok
  }, [editedAt, form, guided, meta, validate, value])

  const touched = meta !== undefined
  return React.useMemo(
    () => ({ value, status, onChange: guided ? onChange : setMeta, guided, touched }),
    [guided, onChange, status, touched, value],
  )
}

export { useMeta as use }
