import type { ErrorObject, JSONType } from 'ajv'
import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'

import * as JSONPointer from 'utils/JSONPointer'
import { JsonSchema } from 'utils/json-schema'
import * as jsonSchemaUtils from 'utils/json-schema/json-schema'
import { Json, JsonRecord } from 'utils/types'

import { COLUMN_IDS, EMPTY_VALUE, ValidationErrors } from './constants'

const JSON_POINTER_PLACEHOLDER = '__*'

const getAddressPath = (key: number | string, parentPath: JSONPointer.Path) =>
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
  valueSchema?: JsonSchema
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

const noKeys: string[] = []

function getSchemaItemKeys(schemaItem: JsonSchema): string[] {
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

const assocObjValue: (p: JSONPointer.Path, v: any, jsonObject: JsonRecord) => JsonRecord =
  R.assocPath

export const getObjValue: (p: JSONPointer.Path, jsonObject: JsonRecord) => JsonRecord =
  R.path

export const getJsonDictValue = (objPath: JSONPointer.Path, jsonDict: JsonDict) =>
  R.prop(JSONPointer.stringify(objPath), jsonDict)

const dissocObjValue: (p: JSONPointer.Path, jsonObject: JsonRecord) => JsonRecord =
  R.dissocPath

function moveObjValue(
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

function calcReactId(valuePath: JSONPointer.Path, value?: Json): string {
  const pathPrefix = JSONPointer.stringify(valuePath)
  // TODO: store preview for value, and reuse it for Preview
  return `${pathPrefix}+${JSON.stringify(value)}`
}

function getDefaultValue(jsonDictItem?: SchemaItem): Json | typeof EMPTY_VALUE {
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

export interface JsonDictItem extends SchemaItem {
  errors: ValidationErrors
  reactId: string
  sortIndex: number

  // TODO: use ./constants.ts module
  key: number | string
  value: Json | typeof EMPTY_VALUE
}

// TODO: extend getJsonDictValue
// TODO: return address too
export function getJsonDictItemRecursively(
  jsonDict: JsonDict,
  parentPath: JSONPointer.Path,
  key?: number | string,
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
  })
  return placeholderItem
}

function getJsonDictItem(
  jsonDict: JsonDict,
  obj: JsonRecord,
  parentPath: JSONPointer.Path,
  key: number | string,
  sortOrder: SortOrder,
  allErrors: ValidationErrors,
): JsonDictItem {
  const valuePath = getAddressPath(key, parentPath)
  const itemAddress = JSONPointer.stringify(valuePath)
  const item = getJsonDictItemRecursively(jsonDict, parentPath, key)
  const storedValue: Json | undefined = R.path(valuePath, obj)
  const value = storedValue === undefined ? getDefaultValue(item) : storedValue
  const errors = collectErrors(allErrors, itemAddress, value)
  return {
    [COLUMN_IDS.KEY]: key,
    [COLUMN_IDS.VALUE]: value,
    errors,
    reactId: calcReactId(valuePath, storedValue),
    ...(item || {
      address: valuePath,
      required: false,
      valueSchema: undefined,
    }),
    sortIndex: (item && item.sortIndex) || sortOrder.current.dict[itemAddress] || 0,
  }
}

function getObjValueKeys(objValue?: Json): (number | string)[] {
  if (Array.isArray(objValue)) return R.range(0, objValue.length)
  if (R.is(Object, objValue)) return Object.keys(objValue as JsonRecord)
  return noKeys
}

function getObjValueKeysByPath(
  obj: JsonRecord,
  objPath: JSONPointer.Path,
  rootKeys: (number | string)[],
): (number | string)[] {
  if (!objPath.length) return rootKeys

  const objValue = R.path(objPath, obj)
  return getObjValueKeys(objValue as Json | undefined)
}

function getSchemaItemKeysByPath(
  jsonDict: JsonDict,
  objPath: JSONPointer.Path,
): (number | string)[] {
  const item = getJsonDictItemRecursively(jsonDict, objPath)
  return item && item.valueSchema ? getSchemaItemKeys(item.valueSchema) : noKeys
}

function getSchemaAndObjKeys(
  obj: JsonRecord,
  jsonDict: JsonDict,
  objPath: JSONPointer.Path,
  rootKeys: (number | string)[],
) {
  return R.uniq([
    ...getSchemaItemKeysByPath(jsonDict, objPath),
    ...getObjValueKeysByPath(obj, objPath, rootKeys),
  ])
}

export function mergeSchemaAndObjRootKeys(
  schema: JsonSchema,
  obj: JsonRecord,
): (number | string)[] {
  const schemaKeys = getSchemaItemKeys(schema)
  const objKeys = getObjValueKeys(obj)
  return R.uniq([...schemaKeys, ...objKeys])
}

interface Column {
  items: JsonDictItem[]
  parent?: Json
}

// TODO: refactor data, decrease number of arguments to three
export function iterateJsonDict(
  jsonDict: JsonDict,
  obj: JsonRecord,
  fieldPath: JSONPointer.Path,
  rootKeys: (number | string)[],
  sortOrder: SortOrder,
  errors: ValidationErrors,
): Column[] {
  if (!fieldPath.length)
    return [
      FP.function.pipe(
        rootKeys,
        R.map((key) => getJsonDictItem(jsonDict, obj, fieldPath, key, sortOrder, errors)),
        R.sortBy(R.prop('sortIndex')),
        (items) => ({
          parent: obj,
          items,
        }),
      ),
    ]

  return ['', ...fieldPath].map((_, index) => {
    const pathPart = R.slice(0, index, fieldPath)

    const keys = getSchemaAndObjKeys(obj, jsonDict, pathPart, rootKeys)
    return FP.function.pipe(
      keys,
      R.map((key) => getJsonDictItem(jsonDict, obj, pathPart, key, sortOrder, errors)),
      R.sortBy(R.prop('sortIndex')),
      (items) => ({
        parent: R.path(pathPart, obj),
        items,
      }),
    )
  })
}

export interface StateRenderProps {
  addRow: (p: JSONPointer.Path, v: any, jsonObject: JsonRecord) => JsonRecord // Adds new key/value pair
  changeValue: (oldObjPath: JSONPointer.Path, key: any, obj: JsonRecord) => JsonRecord // Changes existing key or value
  columns: Column[] // Main source of truth for UI
  fieldPath: JSONPointer.Path // Where is user's focus inside object
  jsonDict: JsonDict // Stores sort order, required fields, types etc.
  menuFieldPath: JSONPointer.Path // where does user open context menu
  removeField: (p: JSONPointer.Path) => JsonRecord // Removes key/value pair
  setFieldPath: (p: JSONPointer.Path) => void // Focus on that path inside object
  setMenuFieldPath: (p: JSONPointer.Path) => void // Open context menu for that path inside object
  transformer: (transform: (jsonObject: JsonRecord) => JsonRecord) => void
}

interface JsonEditorStateProps {
  children: (s: StateRenderProps) => React.ReactElement
  errors: ValidationErrors
  jsonObject: JsonRecord
  schema: JsonSchema
}

export default function JsonEditorState({
  children,
  errors,
  jsonObject,
  schema,
}: JsonEditorStateProps) {
  // NOTE: fieldPath is like URL for editor columns
  //       `['a', 0, 'b']` means we are focused to `{ a: [ { b: %HERE% }, ... ], ... }`
  const [fieldPath, setFieldPath] = React.useState<JSONPointer.Path>([])

  // NOTE: similar to fieldPath, shows where to open ContextMenu
  const [menuFieldPath, setMenuFieldPath] = React.useState<JSONPointer.Path>([])

  // NOTE: incremented sortIndex counter,
  //       and cache for sortIndexes: { [keyA]: sortIndexA, [keyB]: sortIndexB }
  //       it's required to place new fields below existing ones
  const sortOrder = React.useRef<{
    counter: number
    dict: Record<JSONPointer.Pointer, number>
  }>({ counter: 0, dict: {} })

  // NOTE: stores additional info about every object field besides value, like sortIndex, schema etc.
  //       it's a main source of data after actual JSON object
  const jsonDict = React.useMemo(() => {
    sortOrder.current.counter = Number.MIN_SAFE_INTEGER
    const result = iterateSchema(schema, sortOrder, [], {})
    sortOrder.current.counter = 0
    return result
  }, [schema, sortOrder])

  // NOTE: list of root object keys + root schema keys
  const rootKeys = React.useMemo(
    () => mergeSchemaAndObjRootKeys(schema, jsonObject),
    [schema, jsonObject],
  )

  // NOTE: this data represents table columns shown to user
  //       it's the main source of UI data
  const columns = React.useMemo(
    () => iterateJsonDict(jsonDict, jsonObject, fieldPath, rootKeys, sortOrder, errors),
    [errors, jsonObject, jsonDict, fieldPath, rootKeys],
  )

  // TODO: Use `sortIndex: -1` to "remove" fields that cannot be removed,
  //       like properties from JSON Schema
  const removeField = React.useCallback(
    (removingFieldPath) => dissocObjValue(removingFieldPath, jsonObject),
    [jsonObject],
  )

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      // TODO: str is not string, it's any value
      // TODO: make this `safeStr` conversion inside component
      const safeStr = str === EMPTY_VALUE ? '' : str
      if (columnId === COLUMN_IDS.KEY) {
        return moveObjValue(editingFieldPath, safeStr, jsonObject)
      }

      if (columnId === COLUMN_IDS.VALUE) {
        return assocObjValue(editingFieldPath, safeStr, jsonObject)
      }

      return jsonObject
    },
    [jsonObject],
  )

  const addRow = React.useCallback(
    (addFieldPath, key, value) => {
      // NOTE: value can't be `Symbol('empty')`
      //       because it's imposible to have `{ [newKey]: Symbol('empty') }` object
      sortOrder.current.counter += 1

      const newKeyPath = addFieldPath.concat([key])
      const itemAddress = JSONPointer.stringify(newKeyPath)
      sortOrder.current.dict[itemAddress] = sortOrder.current.counter
      return assocObjValue(newKeyPath, value, jsonObject)
    },
    [jsonObject, sortOrder],
  )

  const transformer = React.useCallback(
    (transform) => transform(jsonObject),
    [jsonObject],
  )

  // `jsonDict` and `columns` are main state storages
  return children({
    addRow, // Adds new key/value pair
    changeValue, // Changes existing key or value
    columns, // Main source of truth for UI
    fieldPath, // Where is user's focus inside object
    jsonDict, // Stores sort order, required fields, types etc.
    menuFieldPath, // where does user open context menu
    removeField, // Removes key/value pair
    setFieldPath, // Focus on that path inside object
    setMenuFieldPath, // Open context menu for that path inside object
    transformer,
  })
}
