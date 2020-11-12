import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import State from './State'

const useStyles = M.makeStyles((t) => ({
  inner: {
    display: 'flex',
    overflowX: 'auto',
    MsOverflowStyle: 'none',
    scrollbarWidth: 'none',
    '&::-webkit-scrollbar': {
      display: 'none',
    },
  },
  errors: {
    marginTop: t.spacing(1),
  },
}))

function JsonEditor({
  addRow,
  changeValue,
  className,
  newColumns,
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

  return (
    <div className={className}>
      <div className={classes.inner}>
        {newColumns.map((columnData, index) => {
          const columnPath = R.slice(0, index, fieldPath)
          return (
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
          )
        })}
      </div>

      <Errors className={classes.errors} errors={error || errors} />
    </div>
  )
}

export default function JsonEditorStateWrapper({
  className,
  error,
  onChange,
  schema,
  value,
}) {
  return (
    <State obj={value} optSchema={schema}>
      {(props) => (
        <JsonEditor {...props} error={error} onChange={onChange} className={className} />
      )}
    </State>
  )
}
