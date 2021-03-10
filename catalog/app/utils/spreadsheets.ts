import * as dateFns from 'date-fns'
import * as R from 'ramda'
import xlsx from 'xlsx'

import * as jsonSchema from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'

type MetadataValue = $TSFixMe

type JsonSchema = $TSFixMe

export enum Mode {
  SingleCellContainsAllValues,
  OneCellPerValue,
}

interface Options {
  mode: Mode
}

const defaultOptions = {
  mode: Mode.OneCellPerValue,
}

export function parseCellsAsValues(
  values: MetadataValue[],
): MetadataValue | MetadataValue[] {
  return pipeThru(values)(
    R.reject(R.isNil),
    R.ifElse(R.pipe(R.length, R.equals(1)), R.head, R.identity),
  )
}

export function rowsToJson(rows: MetadataValue[][], options: Options = defaultOptions) {
  return pipeThru(rows)(
    R.map(([key, ...values]) => [
      key,
      options.mode === Mode.OneCellPerValue ? values[0] : parseCellsAsValues(values),
    ]),
    R.fromPairs,
  )
}

export function parseSpreadsheet(
  sheet: xlsx.WorkSheet,
  transpose: boolean,
  options: Options = defaultOptions,
): Record<string, MetadataValue> {
  const rows = xlsx.utils.sheet_to_json<MetadataValue>(sheet, {
    header: 1,
  })
  return rowsToJson(transpose ? R.transpose(rows) : rows, options)
}

export function readSpreadsheet(file: File): Promise<xlsx.WorkSheet> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onabort = () => {
      reject(new Error('abort'))
    }
    reader.onerror = () => {
      reject(reader.error)
    }
    reader.onload = () => {
      const workbook = xlsx.read(reader.result, { type: 'array', cellDates: true })
      resolve(workbook.Sheets[workbook.SheetNames[0]])
    }
    reader.readAsArrayBuffer(file)
  })
}

export function scoreObjectDiff(obj1: {}, obj2: {}): number {
  const keys = Object.keys(obj1)
  return keys.reduce((memo, key) => {
    if (key in obj2) return memo + 1
    return memo
  }, 0)
}

function parseJSON(str: string | number | boolean) {
  if (typeof str !== 'string') return str

  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

const isDate = (value: MetadataValue) => value instanceof Date

const isList = (value: MetadataValue, key: string, schema?: JsonSchema) =>
  schema &&
  schema.properties &&
  jsonSchema.isSchemaArray(schema.properties[key]) &&
  typeof value === 'string'

export function postProcess(
  obj: Record<string, MetadataValue>,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  return R.mapObjIndexed((value: MetadataValue, key: string) => {
    if (isDate(value)) return dateFns.format(value, 'yyyy-MM-dd')

    if (isList(value, key, schema)) return value.split(',').map(parseJSON)

    return parseJSON(value)
  }, obj)
}

export function parseSpreadsheetAgainstSchema(
  sheet: xlsx.WorkSheet,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  const verticalObj = parseSpreadsheet(sheet, true)
  const schemaRoot = schema ? schema.properties : null
  if (schemaRoot) {
    const horizontalObj = parseSpreadsheet(sheet, false)
    if (
      scoreObjectDiff(horizontalObj, schemaRoot) >
      scoreObjectDiff(verticalObj, schemaRoot)
    ) {
      return postProcess(horizontalObj, schema)
    }
  }
  return postProcess(verticalObj, schema)
}

export async function readSpreadsheetAgainstSchema(
  file: File,
  schema: JsonSchema,
): Promise<MetadataValue> {
  const sheet = await readSpreadsheet(file)
  return parseSpreadsheetAgainstSchema(sheet, schema)
}

export const parse = parseSpreadsheet

export const readAgainstSchema = readSpreadsheetAgainstSchema
