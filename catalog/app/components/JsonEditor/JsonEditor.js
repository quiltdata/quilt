import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import State, { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  inner: {
    display: 'flex',
    overflowX: 'auto',
  },
  errors: {
    marginTop: t.spacing(1),
  },
}))

function JsonEditor({
  addRow,
  changeValue,
  className,
  columns,
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
      const newData = makeAction(contextFieldPath, ColumnIds.Key, action)
      if (newData) {
        onChange(newData)
      }
    },
    [makeAction, onChange],
  )

  const onCollapse = React.useCallback(() => {
    setFieldPath(R.init(fieldPath))
  }, [fieldPath, setFieldPath])

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
        {columns.map((columnData, index) => {
          const columnPath = R.slice(0, index, fieldPath)
          return (
            <Column
              {...{
                columnPath,
                data: columnData,
                key: columnPath,
                onAddRow: addRow,
                onCollapse,
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

export default ({ className, error, onChange, schema, value }) => (
  <State obj={value} optSchema={schema}>
    {(props) => (
      <JsonEditor {...props} error={error} onChange={onChange} className={className} />
    )}
  </State>
)
