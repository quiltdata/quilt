import { JsonSchema } from 'utils/json-schema'

// TODO: any JSON or EMPTY_VALUE
export type JsonValue = $TSFixMe

// TODO: make different types for filled and empty rows
export interface RowData {
  address: string[]
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
