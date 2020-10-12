import * as R from 'ramda'
import * as React from 'react'
// import Ajv from 'ajv'

export const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

function getColumn(obj, columnPath) {
  const nestedObj = R.path(columnPath, obj)

  // { key1: value1, key2: value2 }
  // becomes
  // [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  return Object.keys(nestedObj).map((key) => ({
    [ColumnIds.Key]: key,
    [ColumnIds.Value]: nestedObj[key],
  }))
}

export default function useJson(obj, optSchema) {
  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [menu, setMenu] = React.useState([])

  // if (optSchema) {
  //   const ajv = new Ajv()
  //   const validate = ajv.compile(optSchema)
  // }

  const columns = React.useMemo(() => {
    const rootColumn = getColumn(data, [])

    const expandedColumns = fieldPath.map((_, index) => {
      const pathPart = R.slice(0, index + 1, fieldPath)
      return getColumn(data, pathPart)
    })

    return [rootColumn, ...expandedColumns]
  }, [fieldPath, data])

  const changeValue = React.useCallback(
    (editingFieldPath, value) => {
      setData(R.assocPath(editingFieldPath, value, data))
    },
    [data, setData],
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

  return {
    changeValue,
    columns,
    fieldPath,
    menu,
    openKeyMenu,
    openValueMenu,
    setFieldPath,
  }
}
