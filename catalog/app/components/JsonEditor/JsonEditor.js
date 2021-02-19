import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { EMPTY_SCHEMA } from 'utils/json-schema'
import Column from './Column'
import State from './State'

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

const JsonEditor = React.forwardRef(function JsonEditor(
  {
    addRow,
    changeValue,
    className,
    disabled,
    columns,
    jsonDict,
    fieldPath,
    makeAction,
    onChange,
    setFieldPath,
  },
  ref,
) {
  const classes = useStyles()

  const makeStateChange = React.useCallback(
    (callback) => (...args) => {
      const newData = callback(...args)
      if (newData) {
        onChange(newData)
      }
    },
    [onChange],
  )

  const columnData = R.last(columns)

  return (
    <div className={cx({ [classes.disabled]: disabled }, className)}>
      <div className={classes.inner} ref={ref}>
        <Column
          {...{
            columnPath: fieldPath,
            data: columnData,
            jsonDict,
            key: fieldPath,
            onAddRow: makeStateChange(addRow),
            onBreadcrumb: setFieldPath,
            onExpand: setFieldPath,
            onMenuAction: makeStateChange(makeAction),
            onChange: makeStateChange(changeValue),
          }}
        />
      </div>
    </div>
  )
})

export default React.forwardRef(function JsonEditorWrapper(
  { className, disabled, onChange, schema: optSchema, value },
  ref,
) {
  const schema = optSchema || EMPTY_SCHEMA

  return (
    <State jsonObject={value} schema={schema}>
      {(stateProps) => (
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
