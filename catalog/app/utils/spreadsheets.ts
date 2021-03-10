import * as R from 'ramda'
import xlsx from 'xlsx'

import pipeThru from 'utils/pipeThru'

export enum Mode {
  SingleCellContainsAllValues,
  OneCellPerValue,
}

type MetadataValue = $TSFixMe

type JsonSchema = $TSFixMe

interface Options {
  mode: Mode
}

const defaultOptions = {
  mode: Mode.SingleCellContainsAllValues,
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
    const horizontalObj = parseSpreadsheet(sheet, false)
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
