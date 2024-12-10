import * as React from 'react'

import quiltSummarizeSchema from 'schemas/quilt_summarize.json'

import type * as Summarize from 'components/Preview/loaders/summarize'
import { makeSchemaValidator } from 'utils/JSONSchema'

export { default as schema } from 'schemas/quilt_summarize.json'

export interface FileExtended extends Omit<Summarize.FileExtended, 'types'> {
  isExtended: boolean
  type?: Summarize.TypeExtended
}

export interface Column {
  id: string
  file: FileExtended
}

export interface Row {
  id: string
  columns: Column[]
}

export interface Layout {
  rows: Row[]
}

const pathToFile = (path: string): FileExtended => ({ path, isExtended: false })

export const emptyFile: FileExtended = pathToFile('')

const createColumn = (file: FileExtended): Column => ({
  id: crypto.randomUUID(),
  file,
})

const createRow = (file: FileExtended): Row => ({
  id: crypto.randomUUID(),
  columns: [createColumn(file)],
})

export const init = (payload?: Layout) => (): Layout =>
  payload || {
    rows: [createRow(emptyFile)],
  }

function insert<T>(array: T[], index: number, item: T): T[] {
  return array.toSpliced(index, 0, item)
}

function insertAfter<T extends { id: string }>(array: T[], id: string, item: T): T[] {
  const index = array.findIndex((r) => r.id === id)
  return insert(array, index + 1, item)
}

type Callback<T> = (item: T) => T
function replace<T extends { id: string }>(array: T[], id: string, cb: Callback<T>): T[] {
  const index = array.findIndex((r) => r.id === id)
  return array.toSpliced(index, 1, cb(array[index]))
}

export const addRowAfter =
  (rowId: string) =>
  (layout: Layout): Layout => ({
    rows: insertAfter(layout.rows, rowId, createRow(emptyFile)),
  })

export const addColumnAfter =
  (rowId: string, columnId: string) =>
  (file: FileExtended) =>
  (layout: Layout): Layout => ({
    rows: replace(layout.rows, rowId, (row) => ({
      ...row,
      columns: insertAfter(row.columns, columnId, createColumn(file)),
    })),
  })

export const changeValue =
  (rowId: string, columnId: string) =>
  (file: Partial<FileExtended>) =>
  (layout: Layout): Layout => ({
    rows: replace(layout.rows, rowId, (row) => ({
      ...row,
      columns: replace(row.columns, columnId, (column) => ({
        ...column,
        file: {
          ...column.file,
          ...file,
        },
      })),
    })),
  })

export const removeColumn =
  (rowId: string, columnId: string) =>
  (layout: Layout): Layout => {
    const rowIndex = layout.rows.findIndex((r) => r.id === rowId)
    if (layout.rows[rowIndex].columns.length === 1) {
      return {
        rows: layout.rows.toSpliced(rowIndex, 1),
      }
    }
    return {
      rows: replace(layout.rows, rowId, (row) => ({
        ...row,
        columns: row.columns.filter((c) => c.id !== columnId),
      })),
    }
  }

function parseColumn(fileOrPath: Summarize.File): Column {
  if (typeof fileOrPath === 'string') {
    return createColumn(pathToFile(fileOrPath))
  }
  const { types, ...file } = fileOrPath
  if (!types || !types.length) return createColumn({ ...fileOrPath, isExtended: true })
  return createColumn({
    ...file,
    isExtended: true,
    type: typeof types[0] === 'string' ? { name: types[0] } : types[0],
  })
}

function preStringifyType(type: Summarize.TypeExtended): [Summarize.Type] {
  const { name, ...rest } = type
  if (!Object.keys(rest).length) return [name]
  return [
    {
      name,
      ...rest,
    },
  ]
}

function preStringifyColumn(column: Column): Summarize.File {
  const {
    file: { isExtended, type, path, ...file },
  } = column
  if (!type) {
    if (!Object.keys(file).length) return path
    return {
      path,
      ...file,
    }
  }
  return {
    types: preStringifyType(type),
    path,
    ...file,
  }
}

function validate(config: any) {
  const errors = makeSchemaValidator(quiltSummarizeSchema)(config)
  if (errors.length) {
    throw new Error(`Validation error: ${errors.map((e) => e.message).join('\n')}`)
  }
  return undefined
}

export function parse(str: string): Layout {
  const config = JSON.parse(str)

  if (!config) return { rows: [] }
  if (!Array.isArray(config)) throw new Error('Expected array')

  validate(config)

  return {
    rows: config.map((row) => ({
      id: crypto.randomUUID(),
      columns: Array.isArray(row) ? row.map(parseColumn) : [parseColumn(row)],
    })),
  }
}

export function stringify(layout: Layout) {
  const converted = layout.rows
    .map((row) => {
      const columns = row.columns.filter(({ file }) => file.path).map(preStringifyColumn)
      return columns.length > 1 ? columns : columns[0]
    })
    .filter(Boolean)

  validate(converted)

  return JSON.stringify(converted, null, 2)
}

export function useState() {
  const [layout, setLayout] = React.useState<Layout>(init())
  return { layout, setLayout }
}
