import * as dateFns from 'date-fns'
import * as R from 'ramda'
import xlsx from 'xlsx'

import * as jsonSchema from 'utils/json-schema'
import pipeThru from 'utils/pipeThru'

type MetadataValue = $TSFixMe

type JsonSchema = $TSFixMe

export function parseCellsAsValues(
  values: MetadataValue[],
): MetadataValue | MetadataValue[] {
  return values.length === 1 ? values[0] : values
}

export function rowsToJson(rows: MetadataValue[][]) {
  return pipeThru(rows)(
    R.map(([key, ...values]) => [key, parseCellsAsValues(values)]),
    R.fromPairs,
  )
}

export function rowsToRows([head, ...tail]: MetadataValue[][]): Record<
  string,
  MetadataValue
>[] {
  return tail.map((row) =>
    row.reduce((memo, value, index) => {
      if (value === undefined) return memo
      if (head[index] === undefined) return memo
      return {
        ...memo,
        [head[index]]: value,
      }
    }, {}),
  )
}

export function parseSpreadsheet(
  sheet: xlsx.WorkSheet,
  transpose: boolean,
  shouldBeListOfObject?: boolean,
): Record<string, MetadataValue> {
  const rows = xlsx.utils.sheet_to_json<MetadataValue>(sheet, {
    header: 1,
  })
  const parser = shouldBeListOfObject ? rowsToRows : rowsToJson
  return parser(transpose ? R.transpose(rows) : rows)
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

const isDate = (value: MetadataValue, schema?: JsonSchema) =>
  value instanceof Date ||
  (schema && schema.type === 'string' && schema.format === 'date' && value)

const isArrayOfDates = (value: MetadataValue, schema?: JsonSchema) =>
  isDate(value, schema?.items) || isDate(value, schema?.contains)

const isList = (value: MetadataValue, schema?: JsonSchema) =>
  schema && jsonSchema.isSchemaArray(schema) && typeof value === 'string'

const isArrayOfLists = (value: MetadataValue, schema?: JsonSchema) =>
  isList(value, schema?.items) || isList(value, schema?.contains)

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

  if (isList(value, schema)) return value.split(',').map(parseJSON)

  if (isBoolean(value, schema)) return Boolean(value)

  if (isObject(value)) return postProcess(value, schema)

  return parseJSON(value)
}

export function postProcessListValue(
  value: MetadataValue,
  schema?: JsonSchema,
): MetadataValue {
  if (isArrayOfDates(value, schema))
    return dateFns.formatISO(value, { representation: 'date' })

  if (isArrayOfLists(value, schema)) return value.split(',').map(parseJSON)

  if (isArrayOfBooleans(value, schema)) return Boolean(value)

  return parseJSON(value)
}

export function postProcess(
  obj: Record<string, MetadataValue>,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  if (Array.isArray(obj)) return obj.map((v) => postProcess(v, schema.items))
  return R.mapObjIndexed(
    (value: MetadataValue, key: string) =>
      Array.isArray(value)
        ? value.map((v) => postProcessListValue(v, getSchemaItem(key, schema)))
        : postProcessValue(value, getSchemaItem(key, schema)),
    obj,
  )
}

export function parseSpreadsheetAgainstSchema(
  sheet: xlsx.WorkSheet,
  schema?: JsonSchema,
): Record<string, MetadataValue> {
  const verticalObj = parseSpreadsheet(sheet, true, schema?.type === 'array')
  const schemaRoot =
    schema?.type === 'array' ? schema?.items?.properties : schema?.properties
  if (schemaRoot) {
    const horizontalObj = parseSpreadsheet(sheet, false, schema?.type === 'array')
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
