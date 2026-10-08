import type { ErrorObject } from 'ajv'
import * as React from 'react'

import * as Notifications from 'containers/Notifications'
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
  // A server rejection judged the metadata as it was when the submit began; it stands
  // only while no edit has happened since then.
  const [edits, setEdits] = React.useState(0)
  const [submittedAt, setSubmittedAt] = React.useState(0)
  React.useEffect(() => {
    if (form._tag === 'submitting') setSubmittedAt(edits)
  }, [form]) // eslint-disable-line react-hooks/exhaustive-deps
  // a new schema judges the metadata afresh, as an edit would (keyed by content:
  // callers may pass a fresh status object every render)
  const schemaKey =
    schema._tag === 'ready' ? JSON.stringify(schema.schema ?? null) : schema._tag
  const lastSchemaKey = React.useRef(schemaKey)
  React.useEffect(() => {
    if (lastSchemaKey.current === schemaKey) return
    lastSchemaKey.current = schemaKey
    setEdits((n) => n + 1)
  }, [schemaKey])
  const onChange = React.useCallback((m: Types.JsonRecord) => {
    setMeta(m)
    setEdits((n) => n + 1)
  }, [])
  const value = React.useMemo(() => meta || getMetaFallback(manifest), [manifest, meta])
  // submit drops blank keys (getMetaValue), so validation must not count them
  // an array or other non-object root is passed through so validation rejects it
  const submitted = React.useMemo(
    () =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).filter(([k]) => k.trim()))
        : value,
    [value],
  )

  const validate = React.useMemo(() => {
    if (schema._tag === 'error') return () => [schema.error]
    if (schema._tag !== 'ready') return () => [new Error('Schema is not ready')]
    return mkMetaValidator(schema.schema, { keepSet: guided })
  }, [guided, schema])

  // `value`, not `meta`: a revision keeps the manifest's metadata until edited,
  // and that is what gets pushed. Failing here also stops the submit before
  // any file is uploaded.
  // a loading schema is not a metadata error; params holds the submit until it is ready
  const settled = schema._tag === 'ready' || schema._tag === 'error'
  const guidedErrors = React.useMemo(() => {
    if (!guided || !settled) return []
    if (Array.isArray(submitted))
      return [new Error('Metadata must be a valid JSON object')]
    return validate(submitted || {}) ?? []
  }, [guided, settled, submitted, validate])
  const warnings = React.useMemo(() => guidedErrors.filter(isAdvisory), [guidedErrors])
  // mkSubmitValidator's rule, reusing the full pass above: format-only failures do not block
  const validateBlind = React.useMemo(
    () =>
      guided && schema._tag === 'ready'
        ? mkMetaValidator(schema.schema, { formats: false, keepSet: true })
        : null,
    [guided, schema],
  )
  const blockingErrors = React.useMemo(() => {
    if (!guidedErrors.length) return []
    // a non-object root is not a format question; the blind pass would let an array through
    if (Array.isArray(submitted) || !validateBlind) return guidedErrors
    return validateBlind(submitted || {}) ?? []
  }, [guidedErrors, validateBlind, submitted])

  const status: MetaStatus = React.useMemo(() => {
    if (guided) {
      if (form._tag === 'error' && form.fields?.userMeta && edits === submittedAt) {
        return Err(form.fields.userMeta)
      }
      return blockingErrors.length ? Err(blockingErrors) : Ok
    }
    if (form._tag !== 'error') return Ok
    if (form.fields?.userMeta) return Err(form.fields.userMeta)

    const errors = validate(meta || {})
    return errors ? Err(errors) : Ok
  }, [blockingErrors, edits, form, guided, meta, submittedAt, validate])

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
    return Err(new Error(`Finish or undo the edit to ${pendingLabel(pending)}`))
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

/** Pending key for the unsaved new-field row; not a string the UI can produce as a key. */
export const NEW_FIELD = '\u0000new field'

/** Pending key while a metadata file is being read. */
export const IMPORT = '\u0000import'

/** How pending keys read to a person; the new-field row has no name yet. */
export const pendingLabel = (keys: readonly string[]) =>
  keys
    .map((k) =>
      k === NEW_FIELD ? 'the new field' : k === IMPORT ? 'the file import' : `"${k}"`,
    )
    .join(', ')

/**
 * `canChange(what)`: false, with a notice, while any edit is unfinished. Changing the
 * workflow, bucket or source package reloads the editor and would drop those drafts.
 */
export function usePendingGuard(pending: readonly string[]) {
  const { push: notify } = Notifications.use()
  const ref = React.useRef(pending)
  ref.current = pending
  return React.useCallback(
    (what: string) => {
      if (!ref.current.length) return true
      notify(
        `Finish or undo the edit to ${pendingLabel(ref.current)} before changing ${what}`,
      )
      return false
    },
    [notify],
  )
}

/** Workflow and source-package inputs that refuse to change while an edit is unfinished. */
export function useGuardedInputs<W extends { onChange: (w: any) => void }, S>(
  pending: readonly string[],
  workflow: W,
  setSrc: (next: S) => void,
) {
  const canChange = usePendingGuard(pending)
  const guardedWorkflow = React.useMemo(
    () => ({
      ...workflow,
      onChange: (w: Parameters<W['onChange']>[0]) => {
        if (canChange('the workflow')) workflow.onChange(w)
      },
    }),
    [canChange, workflow],
  )
  const guardedSetSrc = React.useCallback(
    (next: S) => {
      if (canChange('the package')) setSrc(next)
    },
    [canChange, setSrc],
  )
  return { canChange, guardedWorkflow, guardedSetSrc }
}

export { useMeta as use }
