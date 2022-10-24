import * as FP from 'fp-ts'
import * as R from 'ramda'
import * as React from 'react'

import * as jsonSchemaUtils from 'utils/json-schema/json-schema'

import { COLUMN_IDS, EMPTY_VALUE } from './constants'

const JSON_POINTER_PLACEHOLDER = '__*'

// TODO: create JSONPointer module, rename function to `stringify`
const serializeAddress = (addressPath) => `/${addressPath.join('/')}`

// TODO: create JSONPointer module, rename function to `parse`
const deserializeAddress = (address) => address.slice(1).split('/')

const getAddressPath = (key, parentPath) =>
  key === '' ? parentPath : (parentPath || []).concat(key)

const getSchemaType = R.prop('type')

const getSchemaItem = ({ item, sortIndex, key, parentPath, required }) => ({
  address: getAddressPath(key, parentPath),
  required,
  valueSchema: item,
  sortIndex,
  type: getSchemaType(item),
})

const assocObjValue = R.assocPath

export const getJsonDictValue = (objPath, jsonDict) =>
  R.prop(serializeAddress(objPath), jsonDict)

export const getObjValue = R.path

function moveObjValue(oldObjPath, key, obj) {
  const oldItem = getObjValue(oldObjPath, obj)
  const oldValue = oldItem === undefined ? EMPTY_VALUE : oldItem
  return assocObjValue(
    R.append(key, R.init(oldObjPath)),
    oldValue,
    dissocObjValue(oldObjPath, obj),
  )
}

const dissocObjValue = R.dissocPath

// TODO: consider to use 'json-schema-traverse'
// NOTE: memo is mutated, sortOrder is React.ref and mutated too
export function iterateSchema(schema, sortOrder, parentPath, memo) {
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
    memo[serializeAddress(item.address)] = item
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
    memo[serializeAddress(item.address)] = item

    // eslint-disable-next-line no-param-reassign
    sortOrder.current.counter += 1
    iterateSchema(rawItem, sortOrder, item.address, memo)
  })

  return memo
}

// NOTE: memo is mutated
// weird eslint bug?
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function objToDict(obj, parentPath, memo) {
  const isObjArray = Array.isArray(obj)
  if (isObjArray) {
    obj.forEach((value, index) => {
      const address = getAddressPath(index, parentPath)
      // eslint-disable-next-line no-param-reassign
      memo[serializeAddress(address)] = value

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
      memo[serializeAddress(address)] = obj[key]

      objToDict(obj[key], address, memo)
    })
    return memo
  }

  return memo
}

function calcReactId(valuePath, value) {
  const pathPrefix = serializeAddress(valuePath)
  // TODO: store preview for value, and reuse it for Preview
  return `${pathPrefix}+${JSON.stringify(value)}`
}

function getDefaultValue(jsonDictItem) {
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

const NO_ERRORS = []

const bigintError = new Error(
  `We don't support numbers larger than ${Number.MAX_SAFE_INTEGER}.
  Please consider converting it to string.`,
)

function collectErrors(allErrors, itemAddress, value) {
  const errors = allErrors
    ? allErrors.filter((error) => error.instancePath === itemAddress)
    : NO_ERRORS

  if (typeof value === 'number' && value > Number.MAX_SAFE_INTEGER) {
    return errors.concat(bigintError)
  }
  return errors
}

function doesPlaceholderPathMatch(placeholder, path) {
  if (placeholder.length !== path.length) return false
  return placeholder.every(
    (item, index) => item === path[index] || item === JSON_POINTER_PLACEHOLDER,
  )
}

// TODO: extend getJsonDictValue
// TODO: return address too
// NOTE: returns jsonDictItem by path from JsonDict handling placeholder paths too
export function getJsonDictItemRecursively(jsonDict, parentPath, key) {
  const addressPath = getAddressPath(typeof key === 'undefined' ? '' : key, parentPath)
  const itemAddress = serializeAddress(addressPath)
  const item = jsonDict[itemAddress]
  if (item) return item

  let weight = 0
  let placeholderItem = undefined
  Object.entries(jsonDict).forEach(([path, value]) => {
    if (doesPlaceholderPathMatch(deserializeAddress(path), addressPath)) {
      if (weight < addressPath.length) {
        weight = addressPath.length
        placeholderItem = value
      }
    }
  })
  return placeholderItem
}

function getJsonDictItem(jsonDict, obj, parentPath, key, sortOrder, allErrors) {
  const itemAddress = serializeAddress(getAddressPath(key, parentPath))
  const item = getJsonDictItemRecursively(jsonDict, parentPath, key)
  // NOTE: can't use R.pathOr, because Ramda thinks `null` is `undefined` too
  const valuePath = getAddressPath(key, parentPath)
  const storedValue = R.path(valuePath, obj)
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

const noKeys = []

function getObjValueKeys(objValue) {
  if (Array.isArray(objValue)) return R.range(0, objValue.length)
  if (R.is(Object, objValue)) return Object.keys(objValue)
  return noKeys
}

function getObjValueKeysByPath(obj, objPath, rootKeys) {
  if (!objPath.length) return rootKeys

  const objValue = R.path(objPath, obj)
  return getObjValueKeys(objValue)
}

function getSchemaItemKeys(schemaItem) {
  if (!schemaItem || !schemaItem.properties) return noKeys
  const keys = Object.keys(schemaItem.properties)

  if (!schemaItem.required) return keys

  const sortOrder = schemaItem.required.reduce(
    (memo, key, index) => ({
      [key]: index,
      ...memo,
    }),
    {},
  )
  const getSortIndex = (key) =>
    R.ifElse(R.has(key), R.prop(key), R.always(Infinity))(sortOrder)
  return R.sortBy(getSortIndex, keys)
}

function getSchemaItemKeysByPath(jsonDict, objPath) {
  const item = getJsonDictItemRecursively(jsonDict, objPath)
  return item && item.valueSchema ? getSchemaItemKeys(item.valueSchema) : noKeys
}

function getSchemaAndObjKeys(obj, jsonDict, objPath, rootKeys) {
  return R.uniq([
    ...getSchemaItemKeysByPath(jsonDict, objPath),
    ...getObjValueKeysByPath(obj, objPath, rootKeys),
  ])
}

// TODO: refactor data, decrease number of arguments to three
export function iterateJsonDict(jsonDict, obj, fieldPath, rootKeys, sortOrder, errors) {
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

export function mergeSchemaAndObjRootKeys(schema, obj) {
  const schemaKeys = getSchemaItemKeys(schema)
  const objKeys = getObjValueKeys(obj)
  return R.uniq([...schemaKeys, ...objKeys])
}

export default function JsonEditorState({ children, errors, jsonObject, schema }) {
  // NOTE: fieldPath is like URL for editor columns
  //       `['a', 0, 'b']` means we are focused to `{ a: [ { b: %HERE% }, ... ], ... }`
  const [fieldPath, setFieldPath] = React.useState([])

  // NOTE: similar to fieldPath, shows where to open ContextMenu
  const [menuFieldPath, setMenuFieldPath] = React.useState([])

  // NOTE: incremented sortIndex counter,
  //       and cache for sortIndexes: { [keyA]: sortIndexA, [keyB]: sortIndexB }
  //       it's required to place new fields below existing ones
  const sortOrder = React.useRef({ counter: 0, dict: {} })

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
      const itemAddress = serializeAddress(newKeyPath)
      sortOrder.current.dict[itemAddress] = sortOrder.current.counter
      return assocObjValue(newKeyPath, value, jsonObject)
    },
    [jsonObject, sortOrder],
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
    setFieldPath, // Focuse on that path inside object
    setMenuFieldPath, // Open context menu for that path inside object
  })
}
