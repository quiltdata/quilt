import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import State from './State'

const useStyles = M.makeStyles((t) => ({
  disabled: {
    position: 'relative',
    '&:after': {
      background: t.palette.action.disabledBackground,
      bottom: 0,
      content: '""',
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
    },
  },
  errors: {
    marginTop: t.spacing(1),
  },
  inner: {
    display: 'flex',
    maxHeight: t.spacing(46),
    overflow: 'auto',
  },
}))

function JsonEditor({
  addRow,
  changeValue,
  className,
  disabled,
  columns,
  jsonDict,
  error,
  errors,
  fieldPath,
  makeAction,
  onChange,
  setFieldPath,
}) {
  const classes = useStyles()

  const onMenuAction = React.useCallback(
    (contextFieldPath, action) => {
      const newData = makeAction(contextFieldPath, action)
      if (newData) {
        onChange(newData)
      }
    },
    [makeAction, onChange],
  )

  const onChangeInternal = React.useCallback(
    (...args) => {
      const newData = changeValue(...args)
      if (newData) {
        onChange(newData)
      }
    },
    [changeValue, onChange],
  )

  const columnData = R.last(columns)
  const columnPath = R.take(columns.length - 1, fieldPath)

  return (
    <div className={cx({ [classes.disabled]: disabled }, className)}>
      <div className={classes.inner}>
        <Column
          {...{
            columnPath,
            data: columnData,
            jsonDict,
            key: columnPath,
            onAddRow: addRow,
            onBreadcrumb: setFieldPath,
            onExpand: setFieldPath,
            onMenuAction,
            onChange: onChangeInternal,
          }}
        />
      </div>

      <Errors className={classes.errors} errors={error || errors} />
    </div>
  )
}

export default function JsonEditorStateWrapper({
  className,
  disabled,
  error,
  onChange,
  schema,
  value,
}) {
  return (
    <State obj={value} optSchema={schema}>
      {(props) => (
        <JsonEditor
          {...{
            className,
            disabled,
            error,
            onChange,
          }}
          {...props}
        />
      )}
    </State>
  )
}
