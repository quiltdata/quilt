import * as R from 'ramda'
import * as React from 'react'
import objectHash from 'object-hash'

import * as M from '@material-ui/core'

import Column from './Column'
import Errors from './Errors'
import useJson, { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(1),
  },

  inner: {
    display: 'flex',
    overflowX: 'auto',
  },

  errors: {
    marginTop: t.spacing(1),
  },
}))

const initialSchema = {
  type: 'object',
  properties: {
    num: {
      type: 'number',
    },
    more: {
      type: 'string',
    },
    user_meta: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        type: { type: 'string' },
        name: { type: 'string' },
        ppu: { type: 'number' },
        batters: {
          type: 'object',
          properties: {
            batter: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  type: { type: 'string' },
                },
              },
            },
          },
        },
      },
      required: ['id', 'type', 'name', 'ppu', 'batters'],
    },
    message: {
      type: 'string',
    },
    version: {
      type: 'string',
    },
  },
  required: ['version', 'message', 'user_meta'],
}

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

export default function JsonEditor() {
  const classes = useStyles()

  const {
    addRow,
    changeValue,
    columns,
    errors,
    fieldPath,
    makeAction,
    setFieldPath,
  } = useJson(initialData, initialSchema)

  const onMenuAction = React.useCallback(
    (contextFieldPath, action) => {
      makeAction(contextFieldPath, ColumnIds.Key, action)
    },
    [makeAction],
  )

  const onCollapse = React.useCallback(() => {
    setFieldPath(R.init(fieldPath))
  }, [fieldPath, setFieldPath])

  return (
    <div className={classes.root}>
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
              updateMyData: changeValue,
            }}
          />
        ))}
      </div>

      <Errors className={classes.errors} errors={errors} />
    </div>
  )
}
