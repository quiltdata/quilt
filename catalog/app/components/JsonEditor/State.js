import * as R from 'ramda'
import * as React from 'react'
import Ajv from 'ajv'
import isArray from 'lodash/isArray'

export const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

export function parseJSON(str) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

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
  const sortIndex = (key) => schemaSort[key] || objSort[key]
  return Object.keys(objectOrArray)
    .sort((a, b) => sortIndex(a) - sortIndex(b))
    .map((key) => callback(objectOrArray[key], key))
}

function getColumn(obj, columnPath, sortOrder, optSchema = {}) {
  const nestedObj = R.path(columnPath, obj)

  const schemaPath = getSchemaPath(columnPath)
  const requiredKeys = R.pathOr([], schemaPath.concat('required'), optSchema)

  const schemedKeysList = Object.keys(
    R.pathOr({}, schemaPath.concat('properties'), optSchema),
  )

  // FIXME: add sort order

  // { key1: value1, key2: value2 }
  // becomes
  // [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return mapKeys(
    nestedObj,
    (value, key) => ({
      [ColumnIds.Key]: key,
      [ColumnIds.Value]: value,

      // These will be available at row.original
      keysList: schemedKeysList,
      required: requiredKeys.includes(key),
      valueType: R.pathOr(
        undefined,
        schemaPath.concat(['properties', key, 'type']),
        optSchema,
      ),
    }),
    schemedKeysList,
  )
}

export default function useJson(obj, optSchema = {}) {
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])
  const [sortOrder, setSortOder] = React.useState({}) // NOTE: { [pathToKey]: number }

  // NOTE: Should be greater than number of keys on schema and object
  const sortCounter = React.useRef(10000000)

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

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      let newData = data

      if (columnId === ColumnIds.Key) {
        // FIXME: add sort order
      }

      if (columnId === ColumnIds.Value) {
        newData = R.assocPath(editingFieldPath, str, data)
      }

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
    setFieldPath,
  }
}
