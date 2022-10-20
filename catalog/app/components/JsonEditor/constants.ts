import type { ErrorObject } from 'ajv'

// import { JsonSchema } from 'utils/json-schema'

import { JsonDictItem } from './State'

// TODO: any JSON or EMPTY_VALUE
export type JsonValue = $TSFixMe

export type ValidationErrors = (Error | ErrorObject)[]

// TODO: make different types for filled and empty rows
// TODO: add `updateMyData: (path: string[], id: 'key' | 'value', value: JsonValue) => void`
export type RowData = JsonDictItem

// TODO: use enum, when converstion to typescript will be done
const KEY: 'key' = 'key'
const VALUE: 'value' = 'value'

export const COLUMN_IDS = {
  KEY,
  VALUE,
}

export const EMPTY_VALUE = Symbol('empty')
