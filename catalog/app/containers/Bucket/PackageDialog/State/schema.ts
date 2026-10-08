import type { ErrorObject } from 'ajv'
import * as React from 'react'
import * as R from 'ramda'

import * as AWS from 'utils/AWS'
import {
  JsonSchema,
  makeSchemaDefaultsSetter,
  makeSchemaValidator,
} from 'utils/JSONSchema'
import * as Request from 'utils/useRequest'
import * as Types from 'utils/types'
import * as workflows from 'utils/workflows'

import { metadataSchema, objectSchema } from '../../requests'

export type SchemaStatus =
  | { _tag: 'idle' }
  | { _tag: 'loading' }
  | { _tag: 'error'; error: Error }
  | { _tag: 'ready'; schema?: JsonSchema }

export const Idle = { _tag: 'idle' as const }
export const Loading = { _tag: 'loading' as const }
export const Err = (error: Error) => ({ _tag: 'error' as const, error })
export const Ready = (schema?: JsonSchema) => ({ _tag: 'ready' as const, schema })

/** `{ formats: false }` ignores `format`, which only quilt's catalog enforces. */
export function mkMetaValidator(
  schema?: JsonSchema,
  { formats = true, keepSet = false } = {},
) {
  // keepSet: defaults come only from the walker below, which submit also runs,
  // so Ajv must not add any to its private copy
  const schemaValidator = makeSchemaValidator(schema, undefined, {
    ...(formats ? {} : { validateFormats: false }),
    ...(keepSet ? { useDefaults: false } : {}),
  })
  return function validateMeta(value: Types.Json): (ErrorObject | Error)[] | undefined {
    const jsonObjectErr = value && !R.is(Object, value)
    if (jsonObjectErr) {
      return [new Error('Metadata must be a valid JSON object')]
    }

    const setDefaults = makeSchemaDefaultsSetter(schema, { keepSet })
    const errors = schemaValidator(setDefaults(value))
    if (errors.length) return errors
  }
}

/**
 * What submit will accept: quilt3 and the registry validate with Draft7Validator and no
 * format checker, so format-blind validation is the server's answer either way: a format
 * failure passes, and a value matching two `oneOf` branches once formats are ignored fails.
 */
export function mkSubmitValidator(schema?: JsonSchema) {
  const blind = mkMetaValidator(schema, { formats: false, keepSet: true })
  return (value: Types.Json): (ErrorObject | Error)[] => blind(value) ?? []
}

export function useMetadataSchema(workflow?: workflows.Workflow): SchemaStatus {
  const s3 = AWS.S3.use()
  const schemaUrl = workflow?.schema?.url
  const req = React.useCallback(() => metadataSchema({ s3, schemaUrl }), [schemaUrl, s3])
  const result = Request.use(req, !!schemaUrl)

  if (!schemaUrl) return Ready()

  if (result === Request.Idle) return Idle
  if (result === Request.Loading) return Loading
  if (result instanceof Error) return Err(result)

  return Ready(result)
}

export function useEntriesSchema(workflow?: workflows.Workflow): SchemaStatus {
  const s3 = AWS.S3.use()
  const schemaUrl = workflow?.entriesSchema || ''
  const req = React.useCallback(() => objectSchema({ s3, schemaUrl }), [schemaUrl, s3])
  const result = Request.use(req, !!schemaUrl)

  if (!schemaUrl) return Ready()

  if (result === Request.Idle) return Idle
  if (result === Request.Loading) return Loading
  if (result instanceof Error) return Err(result)

  return Ready(result)
}
