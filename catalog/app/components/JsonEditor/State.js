import * as R from 'ramda'
import * as React from 'react'
import Ajv from 'ajv'

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

function getColumn(obj, columnPath, optSchema = {}) {
  const nestedObj = R.path(columnPath, obj)

  const schemaPath = getSchemaPath(columnPath)
  const requiredKeys = R.pathOr([], schemaPath.concat('required'), optSchema)

  const keysList = Object.keys(R.pathOr({}, schemaPath.concat('properties'), optSchema))

  // FIXME: add sort order

  // { key1: value1, key2: value2 }
  // becomes
  // [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return Object.keys(nestedObj).map((key) => ({
    [ColumnIds.Key]: key,
    [ColumnIds.Value]: nestedObj[key],

    keysList,
    required: requiredKeys.includes(key),
    valueType: R.pathOr(
      'string',
      schemaPath.concat(['properties', key, 'type']),
      optSchema,
    ),
  }))
}

export default function useJson(obj, optSchema = {}) {
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])

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
    const rootColumn = getColumn(data, [], optSchema)

    const expandedColumns = fieldPath.map((_, index) => {
      const pathPart = R.slice(0, index + 1, fieldPath)
      return getColumn(data, pathPart, optSchema)
    })

    return [rootColumn, ...expandedColumns]
  }, [fieldPath, data, optSchema])

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
    },
    [setData, data],
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
