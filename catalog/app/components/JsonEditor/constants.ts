import type { ErrorObject } from 'ajv'

import { JsonSchema } from 'utils/json-schema'
import { Nullable } from 'utils/types'

// TODO: any JSON or EMPTY_VALUE
export type JsonValue = $TSFixMe

export type ValidationError = Error | ErrorObject

// TODO: make different types for filled and empty rows
export interface RowData {
  address: string[]
  error: Nullable<ValidationError>
  reactId?: string
  required: boolean
  sortIndex: number
  type: string | string[]
  valueSchema?: JsonSchema
  updateMyData: (path: string[], id: 'key' | 'value', value: JsonValue) => void
}

export const COLUMN_IDS = {
  KEY: 'key',
  VALUE: 'value',
}

export const EMPTY_VALUE = Symbol('empty')
