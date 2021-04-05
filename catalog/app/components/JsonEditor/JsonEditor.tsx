import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { EMPTY_SCHEMA, JsonSchema } from 'utils/json-schema'

import Column from './Column'
import State from './State'
import { JsonValue, RowData } from './constants'

const useStyles = M.makeStyles({
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
})

interface JsonEditorProps {
  addRow: (path: string[], key: string | number, value: JsonValue) => void
  changeValue: (path: string[], id: 'key' | 'value', value: JsonValue) => void
  className: string
  columns: {
    items: RowData[]
    parent: JsonValue
  }[]
  disabled: boolean
  fieldPath: string[]
  jsonDict: Record<string, JsonValue>
  onChange: (value: JsonValue) => void
  removeField: (path: string[]) => void
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
    jsonDict,
    onChange,
    removeField,
    setFieldPath,
  },
  ref,
) {
  const classes = useStyles()

  type CallbackArgs =
    | [path: string[], key: string | number, value: JsonValue]
    | [path: string[], key: 'key' | 'value', value: JsonValue | string]
    | [path: string[]]
  const makeStateChange = React.useCallback(
    (callback) => (...args: CallbackArgs) => {
      const newData = callback(...args)
      if (newData) {
        onChange(newData)
      }
    },
    [onChange],
  )

  const columnData = R.last(columns)

  if (!columnData) throw new Error('No column data')

  return (
    <div className={cx({ [classes.disabled]: disabled }, className)}>
      <div className={classes.inner} ref={ref}>
        <Column
          {...{
            columnPath: fieldPath,
            data: columnData,
            jsonDict,
            key: fieldPath.join(','),
            onAddRow: makeStateChange(addRow),
            onBreadcrumb: setFieldPath,
            onChange: makeStateChange(changeValue),
            onExpand: setFieldPath,
            onRemove: makeStateChange(removeField),
          }}
        />
      </div>
    </div>
  )
})

interface JsonEditorWrapperProps {
  className?: string
  disabled?: boolean
  onChange: (value: JsonValue) => void
  schema: JsonSchema
  value: JsonValue
}

export default React.forwardRef(function JsonEditorWrapper(
  { className, disabled, onChange, schema: optSchema, value }: JsonEditorWrapperProps,
  ref,
) {
  const schema = optSchema || EMPTY_SCHEMA

  return (
    <State jsonObject={value} schema={schema}>
      {(stateProps: any) => (
        <JsonEditor
          {...{
            className,
            disabled,
            onChange,
            ref,
          }}
          {...stateProps}
        />
      )}
    </State>
  )
})
