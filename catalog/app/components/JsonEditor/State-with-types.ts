import type { ErrorObject, JSONType } from 'ajv'
import * as R from 'ramda'
import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'
import { JsonSchema } from 'utils/json-schema'
import * as jsonSchemaUtils from 'utils/json-schema/json-schema'
import { Json, JsonRecord } from 'utils/types'

import { COLUMN_IDS, EMPTY_VALUE, ValidationErrors } from './constants'

export const JSON_POINTER_PLACEHOLDER = '__*'

const getAddressPath = (key: string, parentPath: JSONPointer.Path) =>
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

export const dissocObjValue: (p: JSONPointer.Path, jsonObject: JsonRecord) => JsonRecord =
  R.dissocPath

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

// NOTE: memo is mutated
// weird eslint bug?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
/*
export function objToDict(obj: JsonRecord, parentPath: JSONPointer.Path, memo: JsonDict): JsonDict {
  const isObjArray = Array.isArray(obj)
  if (isObjArray) {
    obj.forEach((value, index) => {
      const address = getAddressPath(index, parentPath)
      // eslint-disable-next-line no-param-reassign
      memo[JSONPointer.stringify(address)] = value

      objToDict(value, address, memo)
    })
    return memo
  }

  if (typeof obj === 'object' && obj !== null && !isObjArray) {
    const keys = Object.keys(obj)

    if (!keys.length) return memo

    keys.forEach((key) => {
      const address = getAddressPath(key, parentPath)
      // eslint-disable-next-line no-param-reassign
      memo[JSONPointer.stringify(address)] = obj[key]

      objToDict(obj[key], address, memo)
    })
    return memo
  }

  return memo
}
*/

function calcReactId(valuePath: JSONPointer.Path, value?: Json): string {
  const pathPrefix = JSONPointer.stringify(valuePath)
  // TODO: store preview for value, and reuse it for Preview
  return `${pathPrefix}+${JSON.stringify(value)}`
}

export function getDefaultValue(jsonDictItem?: SchemaItem): Json | typeof EMPTY_VALUE {
  if (!jsonDictItem?.valueSchema) return EMPTY_VALUE

  const defaultFromSchema = jsonSchemaUtils.getDefaultValue(jsonDictItem?.valueSchema)
  if (defaultFromSchema !== undefined) return defaultFromSchema

  // TODO:
  // get defaults from nested objects
  // const setDefaults = jsonSchemaUtils.makeSchemaDefaultsSetter(jsonDictItem?.valueSchema)
  // const nestedDefaultFromSchema = setDefaults()
  // if (nestedDefaultFromSchema !== undefined) return nestedDefaultFromSchema

  return EMPTY_VALUE
}

const NO_ERRORS: ValidationErrors = []

const bigintError = new Error(
  `We don't support numbers larger than ${Number.MAX_SAFE_INTEGER}.
  Please consider converting it to string.`,
)

function collectErrors(
  allErrors: ValidationErrors,
  itemAddress: JSONPointer.Pointer,
  value: Json | typeof EMPTY_VALUE,
): ValidationErrors {
  const errors = allErrors
    ? allErrors.filter((error) => (error as ErrorObject).instancePath === itemAddress)
    : NO_ERRORS

  if (typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
    return errors.concat(bigintError)
  }
  return errors
}

function doesPlaceholderPathMatch(
  placeholder: JSONPointer.Path,
  path: JSONPointer.Path,
): boolean {
  if (placeholder.length !== path.length) return false
  return placeholder.every(
    (item, index) => item === path[index] || item === JSON_POINTER_PLACEHOLDER,
  )
}

interface JsonDictItem extends Partial<SchemaItem> {
  errors: ValidationErrors
  reactId: string
  sortIndex: number

  // TODO: use constants module
  key: string
  value: Json | typeof EMPTY_VALUE
}

// TODO: extend getJsonDictValue
// TODO: return address too
export function getJsonDictItemRecursively(
  jsonDict: JsonDict,
  parentPath: JSONPointer.Path,
  key: string,
): SchemaItem | undefined {
  const addressPath = getAddressPath(typeof key === 'undefined' ? '' : key, parentPath)
  const itemAddress = JSONPointer.stringify(addressPath)
  const item = jsonDict[itemAddress]
  if (item) return item

  let weight = 0
  let placeholderItem = undefined
  Object.entries(jsonDict).forEach(([path, value]) => {
    if (doesPlaceholderPathMatch(JSONPointer.parse(path), addressPath)) {
      if (weight < addressPath.length) {
        weight = addressPath.length
        placeholderItem = value
      }
    }
  }, {})
  return placeholderItem
}

export function getJsonDictItem(
  jsonDict: JsonDict,
  obj: JsonRecord,
  parentPath: JSONPointer.Path,
  key: string,
  sortOrder: SortOrder,
  allErrors: ValidationErrors,
): JsonDictItem {
  const itemAddress = JSONPointer.stringify(getAddressPath(key, parentPath))
  // const item = jsonDict[itemAddress]
  const item = getJsonDictItemRecursively(jsonDict, parentPath, key)
  // NOTE: can't use R.pathOr, because Ramda thinks `null` is `undefined` too
  const valuePath = getAddressPath(key, parentPath)
  const storedValue: Json | undefined = R.path(valuePath, obj)
  const value = storedValue === undefined ? getDefaultValue(item) : storedValue
  const errors = collectErrors(allErrors, itemAddress, value)
  return {
    [COLUMN_IDS.KEY]: key,
    [COLUMN_IDS.VALUE]: value,
    errors,
    reactId: calcReactId(valuePath, storedValue),
    sortIndex: (item && item.sortIndex) || sortOrder.current.dict[itemAddress] || 0,
    ...(item || {}),
  }
}
