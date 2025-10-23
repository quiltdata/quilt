import type { ErrorObject } from 'ajv'
import * as React from 'react'

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
  const [meta, setMeta] = React.useState<Types.JsonRecord>()
  const value = React.useMemo(() => meta || getMetaFallback(manifest), [manifest, meta])

  const validate = React.useMemo(() => {
    if (schema._tag === 'error') return () => [schema.error]
    if (schema._tag !== 'ready') return () => [new Error('Schema is not ready')]
    return mkMetaValidator(schema.schema)
  }, [schema])

  const status: MetaStatus = React.useMemo(() => {
    if (form._tag !== 'error') return Ok
    if (form.fields?.userMeta) return Err(form.fields.userMeta)

    const errors = validate(meta || {})
    return errors ? Err(errors) : Ok
  }, [form, meta, validate])

  return React.useMemo(() => ({ value, status, onChange: setMeta }), [status, value])
}

export { useMeta as use }
