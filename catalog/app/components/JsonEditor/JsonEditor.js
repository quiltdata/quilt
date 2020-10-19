import * as R from 'ramda'
import * as React from 'react'
import cx from 'classnames'
import objectHash from 'object-hash'

import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import useJson, { ColumnIds } from './State'

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

const initialData = {
  version: 'v0',
  message: 'Initial commit, really with',
  user_meta: {
    id: '001',
    type: 'donut',
    name: 'Cake',
    ppu: 0.55,
    batters: {
      batter: [
        {
          id: '1001',
          type: 'Regular',
        },
        {
          id: '1002',
          type: 'Chocolate',
        },
      ],
    },
    topping: [],
  },
}

export default function JsonEditor({ className, onChange, schema }) {
  const classes = useStyles()

  const {
    addRow,
    changeValue,
    columns,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  } = useJson(initialData, schema)

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
              key: objectHash(columnData),
              onAddRow: addRow,
              onCollapse,
              onExpand: setFieldPath,
              onMenuAction,
              updateMyData,
            }}
          />
        ))}
      </div>

      <Errors className={classes.errors} errors={errors} />
    </div>
  )
}
