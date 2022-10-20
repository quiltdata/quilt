import type { ErrorObject } from 'ajv'

// import { JsonSchema } from 'utils/json-schema'

import { JsonDictItem } from './State-with-types'

// TODO: any JSON or EMPTY_VALUE
export type JsonValue = $TSFixMe

export type ValidationErrors = (Error | ErrorObject)[]

// TODO: make different types for filled and empty rows
export type RowData = JsonDictItem
/*
export interface RowData {
  address: string[]
  errors: ValidationErrors
  reactId?: string
  required: boolean
  sortIndex: number
  type: string | string[]
  valueSchema?: JsonSchema
   updateMyData: (path: string[], id: 'key' | 'value', value: JsonValue) => void
}
    */

// TODO: use enum, when converstion to typescript will be done
const KEY: 'key' = 'key'
const VALUE: 'value' = 'value'

export const COLUMN_IDS = {
  KEY,
  VALUE,
}

export const EMPTY_VALUE = Symbol('empty')
