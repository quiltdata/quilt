import type { ErrorObject } from 'ajv'
import * as React from 'react'

import { useFeature } from 'utils/features'
import * as Types from 'utils/types'

import type { FormStatus } from './form'
import { isAdvisoryError as isAdvisory } from './metaGuide'
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
  /** Guided only: problems shown but not blocking, see `isAdvisory`. */
  warnings: ErrorObject[]
  /** Fields with an edit that is not valid yet; submit stays blocked while any exist. */
  pending: readonly string[]
  setPending: (key: string, isPending: boolean) => void
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

  // `value`, not `meta`: a revision keeps the manifest's metadata until edited,
  // and that is what gets pushed. Failing here also stops the submit before
  // any file is uploaded.
  const guidedErrors = React.useMemo(
    () => (guided ? (validate(value || {}) ?? []) : []),
    [guided, validate, value],
  )
  const warnings = React.useMemo(() => guidedErrors.filter(isAdvisory), [guidedErrors])
  // Blocking is decided with formats ignored, so a format failure inside anyOf
  // or oneOf cannot surface as a type or anyOf error that blocks the push.
  const validateBlocking = React.useMemo(() => {
    if (schema._tag !== 'ready') return validate
    return mkMetaValidator(schema.schema, { formats: false })
  }, [schema, validate])
  const blockingErrors = React.useMemo(
    () => (guided ? (validateBlocking(value || {}) ?? []) : []),
    [guided, validateBlocking, value],
  )

  const status: MetaStatus = React.useMemo(() => {
    if (guided) {
      if (form._tag === 'error' && form.fields?.userMeta && editedAt !== form) {
        return Err(form.fields.userMeta)
      }
      return blockingErrors.length ? Err(blockingErrors) : Ok
    }
    if (form._tag !== 'error') return Ok
    if (form.fields?.userMeta) return Err(form.fields.userMeta)

    const errors = validate(meta || {})
    return errors ? Err(errors) : Ok
  }, [blockingErrors, editedAt, form, guided, meta, validate])

  const [pending, setPendingKeys] = React.useState<readonly string[]>([])
  const setPending = React.useCallback(
    (key: string, isPending: boolean) =>
      setPendingKeys((keys) => {
        const has = keys.includes(key)
        if (has === isPending) return keys
        return isPending ? [...keys, key] : keys.filter((k) => k !== key)
      }),
    [],
  )
  const withPending: MetaStatus = React.useMemo(() => {
    if (!guided || !pending.length || status._tag === 'error') return status
    return Err(
      new Error(`Finish or undo the edit to ${pending.map((k) => `"${k}"`).join(', ')}`),
    )
  }, [guided, pending, status])

  const touched = meta !== undefined
  return React.useMemo(
    () => ({
      value,
      status: withPending,
      onChange: guided ? onChange : setMeta,
      guided,
      touched,
      warnings,
      pending,
      setPending,
    }),
    [guided, onChange, pending, setPending, touched, value, warnings, withPending],
  )
}

export { useMeta as use }
