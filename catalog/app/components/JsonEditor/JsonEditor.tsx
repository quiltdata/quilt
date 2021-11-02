import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { EMPTY_SCHEMA, JsonSchema } from 'utils/json-schema'

import Column from './Column'
import State from './State'
import { JsonValue, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  disabled: {
    position: 'relative',
    '&:after': {
      background: 'rgba(255,255,255,0.9)',
      bottom: 0,
      content: '""',
      cursor: 'not-allowed',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      zIndex: 1,
    },
  },
  inner: {
    display: 'flex',
    overflow: 'auto',
  },
  column: {
    maxWidth: t.spacing(65),
  },
}))

interface ColumnData {
  items: RowData[]
  parent: JsonValue
}

interface JsonEditorProps {
  addRow: (path: string[], key: string | number, value: JsonValue) => JsonValue
  changeValue: (path: string[], id: 'key' | 'value', value: JsonValue) => JsonValue
  className?: string
  columns: ColumnData[]
  disabled?: boolean
  fieldPath: string[]
  isMultiColumned: boolean
  jsonDict: Record<string, JsonValue>
  onChange: (value: JsonValue) => JsonValue
  removeField: (path: string[]) => JsonValue
  setFieldPath: (path: string[]) => void
}

const JsonEditor = React.forwardRef<HTMLDivElement, JsonEditorProps>(function JsonEditor(
  {
    addRow,
    changeValue,
    className,
    columns,
    disabled,
    fieldPath,
    isMultiColumned,
    jsonDict,
    onChange,
    removeField,
    setFieldPath,
  },
  ref,
) {
  const classes = useStyles()

  const handleRowAdd = React.useCallback(
    (path: string[], key: string | number, value: JsonValue) => {
      const newData = addRow(path, key, value)
      if (newData) onChange(newData)
    },
    [addRow, onChange],
  )

  const handleRowRemove = React.useCallback(
    (path: string[]) => {
      const newData = removeField(path)
      if (newData) onChange(newData)
    },
    [removeField, onChange],
  )

  const handleValueChange = React.useCallback(
    (path: string[], key: 'key' | 'value', value: JsonValue | string) => {
      const newData = changeValue(path, key, value)
      if (newData) onChange(newData)
    },
    [changeValue, onChange],
  )

  if (!columns.length) throw new Error('No column data')

  const columnsView = React.useMemo(
    () => (isMultiColumned ? columns : ([R.last(columns)] as ColumnData[])),
    [columns, isMultiColumned],
  )

  return (
    <div className={cx({ [classes.disabled]: disabled }, className)}>
      <div className={classes.inner} ref={ref}>
        {columnsView.map((columnData, index) => (
          <Column
            {...{
              className: classes.column,
              columnPath: fieldPath.slice(0, index),
              data: columnData,
              jsonDict,
              key: fieldPath.slice(0, index).join(','),
              onAddRow: handleRowAdd,
              onBreadcrumb: setFieldPath,
              onChange: handleValueChange,
              onExpand: setFieldPath,
              onRemove: handleRowRemove,
            }}
          />
        ))}
      </div>
    </div>
  )
})

interface StateRenderProps {
  addRow: (path: string[], key: string | number, value: JsonValue) => JsonValue
  changeValue: (
    path: string[],
    key: 'key' | 'value',
    value: JsonValue | string,
  ) => JsonValue
  columns: {
    items: RowData[]
    parent: JsonValue
  }[]
  fieldPath: string[]
  jsonDict: Record<string, JsonValue>
  removeField: (path: string[]) => JsonValue
  setFieldPath: (path: string[]) => void
}

interface JsonEditorWrapperProps {
  className?: string
  disabled?: boolean
  isMultiColumned?: boolean
  onChange: (value: JsonValue) => void
  schema?: JsonSchema
  value: JsonValue
}

export default React.forwardRef<HTMLDivElement, JsonEditorWrapperProps>(
  function JsonEditorWrapper(
    { className, disabled, isMultiColumned, onChange, schema: optSchema, value },
    ref,
  ) {
    const schema = optSchema || EMPTY_SCHEMA

    return (
      <State jsonObject={value} schema={schema}>
        {(stateProps: StateRenderProps) => (
          <JsonEditor
            {...{
              className,
              disabled,
              onChange,
              isMultiColumned: !!isMultiColumned,
              ref,
            }}
            {...stateProps}
          />
        )}
      </State>
    )
  },
)
