import * as R from 'ramda'
import * as React from 'react'
import Ajv from 'ajv'
import isArray from 'lodash/isArray'
import toNumber from 'lodash/toNumber'

export const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

export const Actions = {
  ChangeType: 'change_type',
  RemoveField: 'remove_field',
  Select: 'select',
}

export function parseJSON(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

const initialSortCounter = 10000000

function getSchemaPath(objPath) {
  return objPath.reduce((memo, key) => memo.concat(['properties'], key), [])
}

function mapKeys(objectOrArray, callback, schemaKeys) {
  if (isArray(objectOrArray)) {
    return objectOrArray.map(callback)
  }

  const schemaSort = schemaKeys.reduce(
    (memo, key, index) => ({
      [key]: index + 1, // for simplified comparison without `0` check
      ...memo,
    }),
    {},
  )
  const objSort = Object.keys(objectOrArray).reduce(
    (memo, key) => ({
      [key]: Infinity,
      ...memo,
    }),
    {},
  )
  const getSortIndex = (key) => schemaSort[key] || objSort[key]
  return Object.keys(objectOrArray)
    .sort((a, b) => getSortIndex(a) - getSortIndex(b))
    .map((key) => callback(objectOrArray[key], key, schemaSort[key]))
}

function getColumn(obj, columnPath, sortOrder, optSchema = {}) {
  const nestedObj = R.path(columnPath, obj)

  const schemaPath = getSchemaPath(columnPath)
  const requiredKeys = R.pathOr([], schemaPath.concat('required'), optSchema)

  const schemedKeysList = Object.keys(
    R.pathOr({}, schemaPath.concat('properties'), optSchema),
  )

  // NOTE: { key1: value1, key2: value2 }
  //       converts to
  //       [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return mapKeys(
    nestedObj,
    (value, key, schemaSortIndex) => ({
      [ColumnIds.Key]: key,
      [ColumnIds.Value]: value,

      // These will be available at row.original
      keysList: schemedKeysList,
      required: requiredKeys.includes(key),
      sortIndex:
        sortOrder[columnPath.concat(key)] || schemaSortIndex || initialSortCounter,
      valueType: R.pathOr(
        undefined,
        schemaPath.concat(['properties', key, 'type']),
        optSchema,
      ),
    }),
    schemedKeysList,
  ).sort((a, b) => a.sortIndex - b.sortIndex)
}

function convertType(value, typeOf) {
  switch (typeOf) {
    case 'string':
      return JSON.stringify(value)
    case 'number':
      return toNumber(value)
    default:
      return value
  }
}

export default function useJson(obj, optSchema = {}) {
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])
  const [sortOrder, setSortOder] = React.useState({}) // NOTE: { [pathToKey]: number }

  // NOTE: Should be greater than number of keys on schema and object
  const sortCounter = React.useRef(initialSortCounter)

  const ajv = new Ajv()
  const validate = ajv.compile(optSchema)

  const validateOnSchema = React.useCallback(
    (x) => {
      validate(x)
      setErrors(validate.errors || [])
    },
    [setErrors, validate],
  )

  const columns = React.useMemo(() => {
    const rootColumn = getColumn(data, [], sortOrder, optSchema)

    const expandedColumns = fieldPath.map((_, index) => {
      const pathPart = R.slice(0, index + 1, fieldPath)
      return getColumn(data, pathPart, sortOrder, optSchema)
    })

    return [rootColumn, ...expandedColumns]
  }, [fieldPath, data, optSchema, sortOrder])

  const changeType = React.useCallback(
    (contextFieldPath, columnId, typeOf) => {
      const value = R.path(contextFieldPath, data)
      const newData = R.assocPath(contextFieldPath, convertType(value, typeOf), data)
      setData(newData)
      validateOnSchema(newData)
    },
    [data, setData, validateOnSchema],
  )

  const makeAction = React.useCallback(
    (contextFieldPath, columnId, actionItem) => {
      switch (actionItem.action) {
        case Actions.RemoveField:
          removeField(contextFieldPath, actionItem)
          break
        case Actions.Select:
          changeValue(contextFieldPath, ColumnIds.Key, actionItem.title)
          break
        case Actions.ChangeType:
          changeType(contextFieldPath, ColumnIds.Value, actionItem.title)
          break
        // no default
      }
    },
    [changeType, changeValue, removeField],
  )

  const removeField = React.useCallback(
    (removingFieldPath) => {
      const newData = R.dissocPath(removingFieldPath, data)
      setData(newData)
      validateOnSchema(newData)
    },
    [data, setData, validateOnSchema],
  )

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      if (columnId !== ColumnIds.Value) {
        return
      }

      const newData = R.assocPath(editingFieldPath, str, data)
      setData(newData)
      validateOnSchema(newData)
    },
    [data, setData, validateOnSchema],
  )

  const addRow = React.useCallback(
    (addFieldPath, newKey) => {
      const newKeyPath = addFieldPath.concat([newKey])
      const value = ''
      setData(R.assocPath(newKeyPath, value, data))

      sortCounter.current += 1
      setSortOder(R.assocPath(newKeyPath, sortCounter.current, sortOrder))
    },
    [setData, sortCounter, sortOrder, setSortOder, data],
  )

  return {
    addRow,
    changeValue,
    columns,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  }
}
