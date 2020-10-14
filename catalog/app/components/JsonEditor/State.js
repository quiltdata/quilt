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

  // FIXME: add sort order
  const schemaPath = getSchemaPath(columnPath)
  const requiredKeys = R.pathOr([], schemaPath.concat('required'), optSchema)

  // { key1: value1, key2: value2 }
  // becomes
  // [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return Object.keys(nestedObj).map((key) => ({
    [ColumnIds.Key]: key,
    [ColumnIds.Value]: nestedObj[key],

    required: requiredKeys.includes(key),
  }))
}

export default function useJson(obj, optSchema = {}) {
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [menu, setMenu] = React.useState([])
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

        const key = R.last(editingFieldPath)
        const newKey = str

        if (newKey === key) return

        const newKeyPath = R.init(editingFieldPath).concat([newKey])

        if (key === '') {
          const value = ''
          newData = R.assocPath(newKeyPath, value, data)
        } else {
          // const value = R.path(editingFieldPath, data)
          // const auxData = R.assocPath(newKeyPath, value, data)
          // newData = R.dissocPath(editingFieldPath, auxData)
        }
      }

      if (columnId === ColumnIds.Value) {
        newData = R.assocPath(editingFieldPath, str, data)
      }

      setData(newData)
      validateOnSchema(newData)
    },
    [data, setData, validateOnSchema],
  )

  const openKeyMenu = React.useCallback(
    (contextFieldPath) => {
      const schemaPath = contextFieldPath.reduce(
        (memo, key) => memo.concat(['properties'], key),
        [],
      )
      setMenu(Object.keys(R.path(R.init(schemaPath), optSchema)))
    },
    [optSchema, setMenu],
  )

  const openValueMenu = React.useCallback(() => {
    setMenu([])
  }, [setMenu])

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
    menu,
    openKeyMenu,
    openValueMenu,
    setFieldPath,
  }
}
