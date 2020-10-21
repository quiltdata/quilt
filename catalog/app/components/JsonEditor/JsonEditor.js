import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import objectHash from 'object-hash'

import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import State, { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {},

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
      makeAction(contextFieldPath, ColumnIds.Key, action)
    },
    [makeAction],
  )

  const onCollapse = React.useCallback(() => {
    setFieldPath(R.init(fieldPath))
  }, [fieldPath, setFieldPath])

  const updateMyData = React.useCallback(
    (...args) => {
      const newData = changeValue(...args)
      if (newData) {
        onChange(newData)
      }
    },
    [changeValue, onChange],
  )

  return (
    <div className={cx(classes.root, className)}>
      <div className={classes.inner}>
        {columns.map((columnData, index) => (
          <Column
            {...{
              columnPath: R.slice(0, index, fieldPath),
              data: columnData,
              key: objectHash(columnData.items),
              onAddRow: addRow,
              onCollapse,
              onExpand: setFieldPath,
              onMenuAction,
              updateMyData,
            }}
          />
        ))}
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
