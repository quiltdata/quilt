import Ajv from 'ajv'
import toNumber from 'lodash/toNumber'
import * as R from 'ramda'
import * as React from 'react'

import pipeThru from 'utils/pipeThru'

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

export const stringifyJSON = (obj) => JSON.stringify(obj, null, 2)

export function parseJSON(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

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

// TODO: move to utils/validators
export function validateOnSchema(optSchema) {
  const schema = optSchema || emptySchema

  const ajv = new Ajv({ schemaId: 'auto' })
  const validate = ajv.compile(schema)

  return (obj) => {
    validate(obj)
    return validate.errors || []
  }
}

const serializeAddress = (addressPath) => addressPath.join(', ')

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

function assocSchemaSortIndex(objPath, sortIndex, jsonDict) {
  const item = getJsonDictValue(objPath, jsonDict)
  const sortedItem = R.assoc('sortIndex', sortIndex, item)
  return R.assoc(serializeAddress(objPath), sortedItem, jsonDict)
}

function moveSchemaValue(oldObjPath, key, jsonDict) {
  const oldItem = getJsonDictValue(oldObjPath, jsonDict)
  const newObjPath = R.append(key, R.init(oldObjPath))
  // TODO: Copy existing item and warn user
  // const alreadyExistingItem = getJsonDictValue(newObjPath, jsonDict)
  const movingItem = R.assoc('address', newObjPath, oldItem)
  return R.assoc(
    serializeAddress(newObjPath),
    movingItem,
    dissocSchemaValue(oldObjPath, jsonDict),
  )
}

function moveObjValue(oldObjPath, key, obj) {
  const oldItem = getObjValue(oldObjPath, obj)
  const oldValue = oldItem === undefined ? EMPTY_VALUE : oldItem
  return assocObjValue(
    R.append(key, R.init(oldObjPath)),
    oldValue,
    dissocObjValue(oldObjPath, obj),
  )
}

const dissocSchemaValue = (objPath, jsonDict) =>
  R.dissoc(serializeAddress(objPath), jsonDict)

const dissocObjValue = R.dissocPath

// NOTE: memo is mutated, sortCounter is React.ref and mutated too
function iterateSchema(schema, sortCounter, parentPath, memo) {
  if (!schema.properties) return memo

  const requiredKeys = schema.required
  Object.keys(schema.properties || {}).forEach((key) => {
    // eslint-disable-next-line no-param-reassign
    sortCounter.current += 1

    const rawItem = schema.properties[key]
    const required = requiredKeys ? requiredKeys.includes(key) : false
    const item = getSchemaItem({
      item: rawItem,
      key,
      parentPath,
      required,
      sortIndex: sortCounter.current,
    })
    // eslint-disable-next-line no-param-reassign
    memo[serializeAddress(item.address)] = item

    // eslint-disable-next-line no-param-reassign
    sortCounter.current += 1
    iterateSchema(rawItem, sortCounter, item.address, memo)
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
  // NOTE: can't use R.pathOr, because Ramda thinks `null` is `undefined` too
  const storedValue = R.path(getAddressPath(key, parentPath), obj)
  const value = storedValue === undefined ? EMPTY_VALUE : storedValue
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

function mergeSchemaAndObjRootKeys(schema, obj) {
  const schemaKeys = schema && schema.properties ? Object.keys(schema.properties) : []
  const objKeys = Object.keys(obj)
  return R.uniq([...schemaKeys, ...objKeys])
}

export default function JsonEditorState({ children, obj, optSchema }) {
  const schema = optSchema || emptySchema

  // TODO: use function syntax and Ramda currying for setData((prevState) => RamdaCurryFunc(prevState))
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])

  const sortCounter = React.useRef(0)

  const [jsonDict, setJsonDict] = React.useState(() =>
    iterateSchema(schema, sortCounter, [], {}),
  )

  const [rootKeys, setRootKeys] = React.useState(() =>
    mergeSchemaAndObjRootKeys(schema, obj),
  )

  const newColumns = React.useMemo(
    () => iterateJsonDict(jsonDict, data, fieldPath, rootKeys),
    [data, jsonDict, fieldPath, rootKeys],
  )

  const schemaValidator = React.useMemo(() => validateOnSchema(schema), [schema])

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
    },
    [data, schemaValidator, setRootKeys, rootKeys, jsonDict],
  )

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      // TODO: str is not string, it's any value
      // TODO: make this `safeStr` conversion inside component
      const safeStr = str === EMPTY_VALUE ? '' : str
      if (columnId === COLUMN_IDS.KEY) {
        if (editingFieldPath.length === 1) {
          setRootKeys(R.uniq(R.without([editingFieldPath[0]], rootKeys).concat(safeStr)))
        }
        setJsonDict(moveSchemaValue(editingFieldPath, safeStr, jsonDict))

        const newData = moveObjValue(editingFieldPath, safeStr, data)
        setData(newData)
        setErrors(schemaValidator(newData))
        return newData
      }

      if (columnId === COLUMN_IDS.VALUE) {
        if (editingFieldPath.length === 1) {
          setRootKeys(R.uniq(rootKeys.concat(editingFieldPath[0])))
        }

        const newData = assocObjValue(editingFieldPath, safeStr, data)
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
      // NOTE: value can't be `Symbol('empty')`
      //       because it's imposible to have `{ [newKey]: Symbol('empty') }` object
      const value = ''

      if (newKeyPath.length === 1) {
        setRootKeys(R.uniq(rootKeys.concat(newKeyPath[0])))
      }
      sortCounter.current += 1
      setJsonDict(assocSchemaSortIndex(newKeyPath, sortCounter.current, jsonDict))
      const newData = assocObjValue(newKeyPath, value, data)
      setData(newData)
      return newData
    },
    [data, jsonDict, rootKeys, setData, setJsonDict, setRootKeys, sortCounter],
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
