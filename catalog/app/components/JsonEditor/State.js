import * as R from 'ramda'
import * as React from 'react'
import Ajv from 'ajv'
import isArray from 'lodash/isArray'

export const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

export const Actions = {
  RemoveField: 'remove_field',
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

  // { key1: value1, key2: value2 }
  // becomes
  // [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return mapKeys(
    nestedObj,
    (value, key, schemaSortIndex) => ({
      [ColumnIds.Key]: key,
      [ColumnIds.Value]: value,

      // These will be available at row.original
      keysList: schemedKeysList,
      required: requiredKeys.includes(key),
      sortIndex:
        schemaSortIndex || sortOrder[columnPath.concat(key)] || initialSortCounter,
      valueType: R.pathOr(
        undefined,
        schemaPath.concat(['properties', key, 'type']),
        optSchema,
      ),
    }),
    schemedKeysList,
  ).sort((a, b) => a.sortIndex - b.sortIndex)
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

  const makeAction = React.useCallback(
    (contextFieldPath, columnId, actionItem) => {
      switch (actionItem.action) {
        case Actions.RemoveField:
          removeField(contextFieldPath, actionItem)
          break
        // no default
      }
    },
    [removeField],
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
      const newKeyPath = R.init(addFieldPath).concat([newKey])
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
