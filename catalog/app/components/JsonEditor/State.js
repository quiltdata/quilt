import * as R from 'ramda'
import * as React from 'react'
import Ajv from 'ajv'
import isArray from 'lodash/isArray'
import isUndefined from 'lodash/isUndefined'
import toNumber from 'lodash/toNumber'

export const ColumnIds = {
  Key: 'key',
  Value: 'value',
}

export const Actions = {
  ChangeType: 'change_type',
  RemoveField: 'remove_field',
  Select: 'select',
  SelectEnum: 'select_enum',
}

export const EmptyValue = Symbol('empty')

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
  const keys = schemaKeys.reduce(
    (memo, key) => (memo.includes(key) ? memo : memo.concat(key)),
    Object.keys(objectOrArray),
  )
  return keys
    .sort((a, b) => getSortIndex(a) - getSortIndex(b))
    .map((key) => callback(objectOrArray[key], key, schemaSort[key]))
}

function getValueType(key, schemaPath, schema) {
  const schemaType = R.path(schemaPath.concat(['properties', key, 'type']), schema)

  if (!schemaType) return undefined

  const restrictedValues = R.path(schemaPath.concat(['properties', key, 'enum']), schema)
  if (schemaType === 'string' && restrictedValues) return restrictedValues

  return schemaType
}

function getValue(value) {
  return isUndefined(value) ? EmptyValue : value
}

function getColumn(obj, columnPath, sortOrder, schema) {
  const nestedObj = R.path(columnPath, obj)

  const schemaPath = getSchemaPath(columnPath)
  const requiredKeys = R.pathOr([], schemaPath.concat('required'), schema)

  const schemedKeysList = Object.keys(
    R.pathOr({}, schemaPath.concat('properties'), schema),
  )

  // NOTE: { key1: value1, key2: value2 }
  //       converts to
  //       [{ key: 'key1', value: 'value1'}, { key: 'key2', value: 'value2'}]
  const items = mapKeys(
    nestedObj || {},
    (value, key, schemaSortIndex) => {
      // TODO: remove valueType
      const valueType = getValueType(key, schemaPath, schema)
      const valueSchema = R.path(schemaPath.concat(['properties', key]), schema)
      return {
        [ColumnIds.Key]: key,
        [ColumnIds.Value]: getValue(value),

        // These will be available at row.original
        empty: isUndefined(value),
        keysList: schemedKeysList,
        required: requiredKeys.includes(key),
        sortIndex:
          sortOrder[columnPath.concat(key)] || schemaSortIndex || initialSortCounter,
        valueSchema, // TODO: create JsonSchemaType, or probably utils/json-schema-type
        valueType, // TODO: remove valueType
      }
    },
    schemedKeysList,
  ).sort((a, b) => a.sortIndex - b.sortIndex)

  return {
    items,
    parent: nestedObj,
    schema: R.pathOr({}, schemaPath, schema),
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

export function validateOnSchema(obj, schema) {
  const ajv = new Ajv()
  const validate = ajv.compile(schema)
  validate(obj)
  return validate.errors || []
}

export default function JsonEditorState({ children, obj, optSchema }) {
  const schema = optSchema || {}

  const [data, setData] = React.useState(obj)
  const [fieldPath, setFieldPath] = React.useState([])
  const [errors, setErrors] = React.useState([])
  const [sortOrder, setSortOder] = React.useState({}) // NOTE: { [pathToKey]: number }

  // NOTE: Should be greater than number of keys on schema and object
  const sortCounter = React.useRef(initialSortCounter)

  const columns = React.useMemo(() => {
    const rootColumn = getColumn(data, [], sortOrder, schema)

    const expandedColumns = fieldPath.map((_, index) => {
      const pathPart = R.slice(0, index + 1, fieldPath)
      return getColumn(data, pathPart, sortOrder, schema)
    })

    return [rootColumn, ...expandedColumns]
  }, [fieldPath, data, schema, sortOrder])

  const changeType = React.useCallback(
    (contextFieldPath, columnId, typeOf) => {
      const value = R.path(contextFieldPath, data)
      const newData = R.assocPath(contextFieldPath, convertType(value, typeOf), data)
      setData(newData)
      setErrors(validateOnSchema(newData, schema))
    },
    [data, schema],
  )

  const makeAction = React.useCallback(
    (contextFieldPath, columnId, actionItem) => {
      switch (actionItem.action) {
        case Actions.RemoveField:
          removeField(contextFieldPath, actionItem)
          break
        case Actions.SelectEnum:
          changeValue(contextFieldPath, ColumnIds.Value, actionItem.title)
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
      setErrors(validateOnSchema(newData, schema))
    },
    [data, schema],
  )

  const changeValue = React.useCallback(
    (editingFieldPath, columnId, str) => {
      if (columnId !== ColumnIds.Value) {
        return null
      }

      const newData = R.assocPath(editingFieldPath, str, data)
      setData(newData)
      setErrors(validateOnSchema(newData, schema))
      return newData
    },
    [data, schema],
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

  return children({
    addRow,
    changeValue,
    columns,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  })
}
