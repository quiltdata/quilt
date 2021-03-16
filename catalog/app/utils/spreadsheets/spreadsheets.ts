import * as dateFns from 'date-fns'
import * as R from 'ramda'
import xlsx from 'xlsx'

import * as jsonSchema from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'

type MetadataValue = $TSFixMe

type JsonSchema = $TSFixMe

export function rowsToJson(rows: MetadataValue[][]) {
  return pipeThru(rows)(
    R.map(([key, ...values]) => {
      if ((key === null || key === undefined) && process.env.NODE_ENV !== 'test') {
        // eslint-disable-next-line no-console
        console.warn("Column's key is empty", [key, ...values])
      }
      const columnName = key === undefined ? 'null' : key
      // Array spread fills empty items with `undefined`
      const columnValues = [...values].map((value) =>
        value === undefined ? null : value,
      )
      return [columnName, columnValues]
    }),
    R.fromPairs,
  )
}

export function parseSpreadsheet(
  sheet: xlsx.WorkSheet,
  transpose: boolean,
): Record<string, MetadataValue> {
  const rows = xlsx.utils.sheet_to_json<MetadataValue>(sheet, {
    header: 1,
  })
  const maxSize = rows.reduce((memo, row) => R.max(memo, row.length), 0)
  return pipeThru(rows)(
    R.without([[]]),
    R.map((row: any[]) => {
      const nullsTail = R.repeat(null, maxSize - row.length)
      return R.concat(row, nullsTail)
    }),
    transpose ? R.transpose : R.identity,
    rowsToJson,
  )
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

export const scoreObjectDiff = (obj1: {}, obj2: {}): number =>
  R.intersection(Object.keys(obj1), Object.keys(obj2)).length

function parseJSON(str: string | number | boolean) {
  if (typeof str !== 'string') return str

  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

const isDate = (value: MetadataValue, schema?: JsonSchema) =>
  value instanceof Date ||
  (schema && schema.type === 'string' && schema.format === 'date' && value)

const isArrayOfDates = (value: MetadataValue, schema?: JsonSchema) =>
  isDate(value, schema?.items) || isDate(value, schema?.contains)

const isArray = (value: MetadataValue, schema?: JsonSchema) =>
  schema && jsonSchema.isSchemaArray(schema) && typeof value === 'string'

const isArrayOfArrays = (value: MetadataValue, schema?: JsonSchema) =>
  isArray(value, schema?.items) || isArray(value, schema?.contains)

const isBoolean = (value: MetadataValue, schema?: JsonSchema) =>
  schema && jsonSchema.isSchemaBoolean(schema) && (value === 1 || value === 0)

const isArrayOfBooleans = (value: MetadataValue, schema?: JsonSchema) =>
  isBoolean(value, schema?.items) || isBoolean(value, schema?.contains)

const isObject = (value: MetadataValue) => R.is(Object, value)

const getSchemaItem = (key: string, schema?: JsonSchema) =>
  schema && schema.properties && schema.properties[key]

export function postProcessValue(
  value: MetadataValue,
  schema?: JsonSchema,
): MetadataValue {
  if (isDate(value, schema)) return dateFns.formatISO(value, { representation: 'date' })

  if (isArray(value, schema)) return value.split(',').map(parseJSON)

  if (isBoolean(value, schema)) return Boolean(value)

  if (isObject(value)) return postProcess(value, schema)

  return parseJSON(value)
}

export function postProcessArrayValue(
  value: MetadataValue,
  schema?: JsonSchema,
): MetadataValue {
  if (isArrayOfDates(value, schema))
    return dateFns.formatISO(value, { representation: 'date' })

  if (isArrayOfArrays(value, schema)) return value.split(',').map(parseJSON)

  if (isArrayOfBooleans(value, schema)) return Boolean(value)

  return parseJSON(value)
}

export function postProcess(
  obj: Record<string, MetadataValue>,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  if (Array.isArray(obj)) return obj.map((v) => postProcess(v, schema?.items))
  return R.mapObjIndexed(
    (value: MetadataValue, key: string) =>
      Array.isArray(value)
        ? value.map((v) => postProcessArrayValue(v, getSchemaItem(key, schema)))
        : postProcessValue(value, getSchemaItem(key, schema)),
    obj,
  )
}

export function parseSpreadsheetAgainstSchema(
  sheet: xlsx.WorkSheet,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  const verticalObj = parseSpreadsheet(sheet, true)
  const schemaRoot =
    schema?.type === 'array' ? schema?.items?.properties : schema?.properties
  if (schemaRoot) {
    const horizontalObj = parseSpreadsheet(sheet, false)
    if (
      scoreObjectDiff(
        schema?.type === 'array' ? horizontalObj[0] : horizontalObj,
        schemaRoot,
      ) >
      scoreObjectDiff(schema?.type === 'array' ? verticalObj[0] : verticalObj, schemaRoot)
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
