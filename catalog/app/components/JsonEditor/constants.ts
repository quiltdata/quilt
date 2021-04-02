import { JsonSchema } from 'utils/json-schema'

// TOOD: any JSON or EMPTY_VALUE
export type JsonValue = $TSFixMe

// NOTE: this is react-table's row.original
// NOTE: properties types are added on demand, feel free to add if I miss some
// TODO: make different types for filled and empty rows
export interface RowData {
  address: string[]
  required: boolean
  sortIndex: number
  type: string | string[]
  valueSchema: JsonSchema
}

export const COLUMN_IDS = {
  KEY: 'key',
  VALUE: 'value',
}

export const EMPTY_VALUE = Symbol('empty')
