import * as R from 'ramda'
import xlsx from 'xlsx'

import pipeThru from 'utils/pipeThru'

type MetadataValue = $TSFixMe

type JsonSchema = $TSFixMe

export function rowsToJson(rows: MetadataValue[][]) {
  return pipeThru(rows)(
    R.map(([key, ...values]) => [
      key,
      pipeThru(values)(
        R.reject(R.isNil), // remove `null` and `undefined` from [value, undefined, null]
        R.ifElse(R.pipe(R.length, R.equals(1)), R.head, R.identity), // get array or just first item if array
      ),
    ]),
    R.fromPairs,
  )
}

export function parseSpreadsheet(
  sheet: xlsx.WorkSheet,
  transpose?: boolean,
): Record<string, MetadataValue> {
  const rows = xlsx.utils.sheet_to_json<MetadataValue>(sheet, {
    header: 1,
  })
  return rowsToJson(transpose ? R.transpose(rows) : rows)
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
      const workbook = xlsx.read(reader.result, { type: 'array' })
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

export function parseSpreadsheetAgainstSchema(sheet: xlsx.WorkSheet, schema: JsonSchema) {
  const verticalObj = parseSpreadsheet(sheet, true)
  const schemaRoot = schema ? schema.properties : null
  if (schemaRoot) {
    const horizontalObj = parseSpreadsheet(sheet)
    if (
      scoreObjectDiff(horizontalObj, schemaRoot) >
      scoreObjectDiff(verticalObj, schemaRoot)
    ) {
      return horizontalObj
    }
  }
  return verticalObj
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
