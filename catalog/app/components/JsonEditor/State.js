import Ajv from 'ajv'
import isArray from 'lodash/isArray'
import toNumber from 'lodash/toNumber'
import * as R from 'ramda'
import * as React from 'react'

import pipeThru from 'utils/pipeThru'

// FIXME: don't forget about sort order

export const COLUMN_IDS = {
  KEY: 'key',
  VALUE: 'value',
}

export const ACTIONS = {
  CHANGE_TYPE: 'change_type',
  REMOVE_FIELD: 'remove_field',
  SELECT_ENUM: 'select_enum',
}

export const EMPTY_VALUE = Symbol('empty')

export function stringifyJSON(obj) {
  return JSON.stringify(obj, null, 2)
}

export function parseJSON(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

const initialSortCounter = 10000000

function convertType(value, typeOf) {
  switch (typeOf) {
    case 'string':
      return stringifyJSON(value)
    case 'number':
      return toNumber(value)
    default:
      return value
  }
}

const emptySchema = {}

// TODO: move to utils/json-schema
export function validateOnSchema(optSchema) {
  const schema = optSchema || emptySchema

  const ajv = new Ajv({ schemaId: 'auto' })
  const validate = ajv.compile(schema)

  return (obj) => {
    validate(obj)
    return validate.errors || []
  }
}

function serializeAddress(addressPath) {
  return addressPath.join(', ')
}

function getAddressPath(key, parentPath) {
  if (key === '') return parentPath
  return (parentPath || []).concat(key)
}

function getSchemaType(item) {
  return item.type
}

function getSchemaItem({ item, sortIndex, key, parentPath, required }) {
  return {
    address: getAddressPath(key, parentPath),
    required,
    valueSchema: item,
    sortIndex,
    type: getSchemaType(item),
  }
}

function assocSchemaItem(objPath, item, jsonDict) {
  const movingItem = R.assoc('address', objPath, item)
  return R.assoc(serializeAddress(objPath), movingItem, jsonDict)
}

function assocObjValue(objPath, value, obj) {
  return R.assocPath(objPath, value, obj)
}

export function getJsonDictValue(objPath, jsonDict) {
  return R.prop(serializeAddress(objPath), jsonDict)
}

export function getObjValue(objPath, obj) {
  return R.path(objPath, obj)
}

function moveSchemaValue(oldObjPath, key, jsonDict) {
  // TODO: move whole item
  const oldItem = getJsonDictValue(oldObjPath, jsonDict)
  return assocSchemaItem(
    R.append(key, R.init(oldObjPath)),
    oldItem,
    dissocSchemaValue(oldObjPath, jsonDict),
  )
}

function moveObjValue(oldObjPath, key, obj) {
  const oldItem = getObjValue(oldObjPath, obj)
  const oldValue = oldItem === undefined ? EMPTY_VALUE : oldItem
  return assocObjValue(
    R.append(key, R.init(oldObjPath)),
    oldValue,
    dissocSchemaValue(oldObjPath, obj),
  )
}

function dissocSchemaValue(objPath, jsonDict) {
  return R.dissoc(serializeAddress(objPath), jsonDict)
}

function dissocObjValue(objPath, obj) {
  return R.dissoc(objPath, obj)
}

// NOTE: memo is mutated
function iterateSchema(schema, sortIndex, parentPath, memo) {
  if (!schema.properties) return memo

  let sortCounter = sortIndex
  const requiredKeys = schema.required
  Object.keys(schema.properties || {}).forEach((key) => {
    const rawItem = schema.properties[key]
    const required = requiredKeys ? requiredKeys.includes(key) : false
    sortCounter += 1
    const item = getSchemaItem({
      item: rawItem,
      key,
      parentPath,
      required,
      sortIndex: sortCounter,
    })
    // eslint-disable-next-line no-param-reassign
    memo[serializeAddress(item.address)] = item

    iterateSchema(rawItem, sortCounter + 1, item.address, memo)
  })

  return memo
}

// NOTE: memo is mutated
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

      // weird eslint bug?
      // eslint-disable-next-line no-unused-vars
      objToDict(obj[key], address, memo)
    })
    return memo
  }

  return memo
}

function getJsonDictItem(jsonDict, obj, parentPath, key) {
  const itemAddress = serializeAddress(getAddressPath(key, parentPath))
  const item = jsonDict[itemAddress]
  const value = R.pathOr(EMPTY_VALUE, getAddressPath(key, parentPath), obj)
  return {
    [COLUMN_IDS.KEY]: key,
    [COLUMN_IDS.VALUE]: value,
    ...(item || {}),
  }
}

function getObjKeys(obj, objPath, rootKeys) {
  if (!objPath.length) return rootKeys
  const objValue = R.path(objPath, obj)

  if (Array.isArray(objValue)) return objValue.map((_v, i) => i)
  if (typeof objValue === 'object' && objValue !== null) return Object.keys(objValue)

  return []
}

function iterateJsonDict(jsonDict, obj, fieldPath, rootKeys) {
  if (!fieldPath.length)
    return [
      pipeThru(rootKeys)(
        R.map((key) => getJsonDictItem(jsonDict, obj, fieldPath, key)),
        R.sortBy(R.prop('sortIndex')),
        (items) => ({
          parent: obj,
          items,
        }),
      ),
    ]

  return ['', ...fieldPath].map((_, index) => {
    const pathPart = R.slice(0, index, fieldPath)

    // keys: Object.keys(rawItem.properties || {}),

    const keys = getObjKeys(obj, pathPart, rootKeys)
    return pipeThru(keys)(
      R.map((key) => getJsonDictItem(jsonDict, obj, pathPart, key)),
      R.sortBy(R.prop('sortIndex')),
      (items) => ({
        parent: R.path(pathPart, obj),
        items,
      }),
    )
  })
}

function mergeSchmaAndObjRootKeys(schema, obj) {
  const schemaKeys = Object.keys(schema.properties)
  const objKeys = Object.keys(obj)
  return R.uniq([...schemaKeys, ...objKeys])
}

export default function JsonEditorState({ children, obj, optSchema }) {
  const schema = optSchema || emptySchema

  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])
  const [sortOrder, setSortOder] = React.useState({}) // NOTE: { [pathToKey]: number }

  const [jsonDict, setJsonDict] = React.useState(() =>
    iterateSchema(optSchema, 1, [], {}),
  )

  // TODO: use Set
  const [rootKeys, setRootKeys] = React.useState(() =>
    mergeSchmaAndObjRootKeys(optSchema, obj),
  )

  const newColumns = React.useMemo(
    () => iterateJsonDict(jsonDict, data, fieldPath, rootKeys),
    [data, jsonDict, fieldPath, rootKeys],
  )

  const schemaValidator = React.useMemo(() => validateOnSchema(schema), [schema])

  // NOTE: Should be greater than number of keys on schema and object
  const sortCounter = React.useRef(initialSortCounter)

  const changeType = React.useCallback(
    (contextFieldPath, columnId, typeOf) => {
      const value = R.path(contextFieldPath, data)
      const newData = R.assocPath(contextFieldPath, convertType(value, typeOf), data)
      setData(newData)
      setErrors(schemaValidator(newData))
      return newData
    },
    [data, schemaValidator],
  )

  const makeAction = React.useCallback(
    (contextFieldPath, actionItem) => {
      switch (actionItem.action) {
        case ACTIONS.REMOVE_FIELD:
          return removeField(contextFieldPath)
        case ACTIONS.SELECT_ENUM:
          return changeValue(contextFieldPath, COLUMN_IDS.VALUE, actionItem.title)
        case ACTIONS.CHANGE_TYPE:
          return changeType(contextFieldPath, COLUMN_IDS.VALUE, actionItem.title)
        default:
          return null
      }
    },
    [changeType, changeValue, removeField],
  )

  const removeField = React.useCallback(
    (removingFieldPath) => {
      if (removingFieldPath.length === 1) {
        setRootKeys(R.without(removingFieldPath, rootKeys))
      }
      setJsonDict(dissocSchemaValue(removingFieldPath, jsonDict))
      const newData = dissocObjValue(removingFieldPath, data)
      setData(newData)
      setErrors(schemaValidator(newData))

      const parentObjectOrArray = R.path(R.init(removingFieldPath), newData)
      // NOTE: edited array has a different value on `removingFieldPath`
      if (!isArray(parentObjectOrArray)) {
        // HACK: sort out key if it in schema and still want rendering
        setSortOder(R.assoc(removingFieldPath.join(), -1, sortOrder))
      }
      return newData
    },
    [data, schemaValidator, sortOrder, setRootKeys, rootKeys, jsonDict],
  )

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      if (columnId === COLUMN_IDS.KEY) {
        if (editingFieldPath.length === 1) {
          setRootKeys(R.uniq(R.without([editingFieldPath[0]], rootKeys).concat(str)))
        }
        setJsonDict(moveSchemaValue(editingFieldPath, str, jsonDict))

        const newData = moveObjValue(editingFieldPath, str, data)
        setData(newData)
        setErrors(schemaValidator(newData))
        return newData
      }

      if (columnId === COLUMN_IDS.VALUE) {
        if (editingFieldPath.length === 1) {
          setRootKeys(R.uniq(rootKeys.concat(editingFieldPath[0])))
        }
        // setJsonDict(assocSchemaValue(editingFieldPath, jsonDict))

        const newData = assocObjValue(editingFieldPath, str, data)
        setData(newData)
        setErrors(schemaValidator(newData))
        return newData
      }

      return data
    },
    [data, schemaValidator, setJsonDict, jsonDict, setRootKeys, rootKeys],
  )

  const addRow = React.useCallback(
    (addFieldPath, newKey) => {
      const newKeyPath = addFieldPath.concat([newKey])
      const value = '' // NOTE: it can't be { key: Symbol('empty') }

      sortCounter.current += 1
      setSortOder(R.assoc(newKeyPath.join(), sortCounter.current, sortOrder))

      if (newKeyPath.length === 1) {
        setRootKeys(R.uniq(rootKeys.concat(newKeyPath[0])))
      }
      // TODO: add sort index
      // setJsonDict(assocSchemaValue(newKeyPath, jsonDict))
      const newData = assocObjValue(newKeyPath, value, data)
      setData(newData)
      return newData
    },
    [
      setData,
      sortCounter,
      sortOrder,
      setSortOder,
      data,
      setRootKeys,
      rootKeys,
      // setJsonDict,
      // jsonDict,
    ],
  )

  return children({
    addRow,
    changeValue,
    newColumns,
    jsonDict,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  })
}
