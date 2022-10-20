import type { JSONType } from 'ajv'
import * as R from 'ramda'
import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'
import { JsonSchema } from 'utils/json-schema'
import { JsonRecord } from 'utils/types'

import { EMPTY_VALUE } from './constants'

export const JSON_POINTER_PLACEHOLDER = '__*'

export const getAddressPath = (key: string, parentPath: JSONPointer.Path) =>
  key === '' ? parentPath : (parentPath || []).concat(key)

const getSchemaType = (s: JsonSchema) => s.type as JSONType

interface SchemaItemArgs {
  item: JsonSchema
  sortIndex: number
  key: string
  parentPath: JSONPointer.Path
  required: boolean
}

interface SchemaItem {
  address: JSONPointer.Path
  required: boolean
  valueSchema: JsonSchema
  sortIndex: number
  type?: string
}

type JsonDict = Record<JSONPointer.Pointer, SchemaItem>

const getSchemaItem = ({
  item,
  sortIndex,
  key,
  parentPath,
  required,
}: SchemaItemArgs): SchemaItem => ({
  address: getAddressPath(key, parentPath),
  required,
  valueSchema: item,
  sortIndex,
  type: getSchemaType(item),
})

export const noKeys = []

export function getSchemaItemKeys(schemaItem: JsonSchema): string[] {
  if (!schemaItem || !schemaItem.properties) return noKeys
  const keys = Object.keys(schemaItem.properties)

  if (!schemaItem.required) return keys

  const sortOrder = schemaItem.required.reduce(
    (memo: { [x: string]: number }, key: string, index: number) => ({
      [key]: index,
      ...memo,
    }),
    {} as { [x: string]: number },
  )
  const getSortIndex = (key: string) =>
    R.ifElse(R.has(key), R.prop(key), R.always(Infinity))(sortOrder)
  return R.sortBy(getSortIndex, keys)
}

type SortOrder = React.MutableRefObject<{
  counter: number
  dict: Record<JSONPointer.Pointer, number>
}>

// TODO: consider to use 'json-schema-traverse'
// NOTE: memo is mutated, sortOrder is React.ref and mutated too
export function iterateSchema(
  schema: JsonSchema,
  sortOrder: SortOrder,
  parentPath: JSONPointer.Path,
  memo: JsonDict,
): JsonDict {
  if (schema.additionalProperties || schema.items) {
    const rawItem = schema.additionalProperties || schema.items
    const item = getSchemaItem({
      item: rawItem,
      key: JSON_POINTER_PLACEHOLDER,
      parentPath,
      required: false,
      sortIndex: sortOrder.current.counter,
    })
    // eslint-disable-next-line no-param-reassign
    memo[JSONPointer.stringify(item.address)] = item
    // eslint-disable-next-line no-param-reassign
    sortOrder.current.counter += 1
    iterateSchema(rawItem, sortOrder, item.address, memo)
  }

  if (!schema.properties) return memo

  const requiredKeys = schema.required
  getSchemaItemKeys(schema).forEach((key) => {
    // eslint-disable-next-line no-param-reassign
    sortOrder.current.counter += 1

    const rawItem = schema.properties[key]
    const required = requiredKeys ? requiredKeys.includes(key) : false
    const item = getSchemaItem({
      item: rawItem,
      key,
      parentPath,
      required,
      sortIndex: sortOrder.current.counter,
    })
    // eslint-disable-next-line no-param-reassign
    memo[JSONPointer.stringify(item.address)] = item

    // eslint-disable-next-line no-param-reassign
    sortOrder.current.counter += 1
    iterateSchema(rawItem, sortOrder, item.address, memo)
  })

  return memo
}

export const assocObjValue: (
  p: JSONPointer.Path,
  v: any,
  jsonObject: JsonRecord,
) => JsonRecord = R.assocPath

export const getObjValue: (p: JSONPointer.Path, jsonObject: JsonRecord) => JsonRecord =
  R.path

export const getJsonDictValue = (objPath: JSONPointer.Path, jsonDict: JsonDict) =>
  R.prop(JSONPointer.stringify(objPath), jsonDict)

export function moveObjValue(
  oldObjPath: JSONPointer.Path,
  key: any,
  obj: JsonRecord,
): JsonRecord {
  const oldItem = getObjValue(oldObjPath, obj)
  const oldValue = oldItem === undefined ? EMPTY_VALUE : oldItem
  return assocObjValue(
    R.append(key, R.init(oldObjPath)),
    oldValue,
    dissocObjValue(oldObjPath, obj),
  )
}

export const dissocObjValue: (p: JSONPointer.Path, jsonObject: JsonRecord) => JsonRecord =
  R.dissocPath
