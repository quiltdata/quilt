import * as React from 'react'
import * as M from '@material-ui/core'

import Cell from './Cell'
import { COLUMN_IDS, EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
    width: t.spacing(20),
  },
  emptyCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
    width: t.spacing(36),
  },
}))

const emptyKeyProps = {
  column: {
    id: COLUMN_IDS.KEY,
  },
  row: {
    original: {},
    values: {
      [COLUMN_IDS.KEY]: EMPTY_VALUE,
      [COLUMN_IDS.VALUE]: EMPTY_VALUE,
    },
  },
  value: EMPTY_VALUE,
}

const emptyValueProps = {
  column: {
    id: COLUMN_IDS.VALUE,
  },
  row: {
    original: {},
    values: {
      [COLUMN_IDS.KEY]: EMPTY_VALUE,
      [COLUMN_IDS.VALUE]: EMPTY_VALUE,
    },
  },
  value: EMPTY_VALUE,
}

export default function AddRow({ columnPath, onAdd, onExpand }) {
  const classes = useStyles()

  const [value, setValue] = React.useState('')

  const onChangeKey = React.useCallback(
    (_1, _2, key) => {
      if (!key) return
      onAdd(columnPath, key, value)
    },
    [columnPath, value, onAdd],
  )

  const onChangeValue = React.useCallback(
    (_1, _2, newValue) => {
      if (newValue === undefined || newValue === EMPTY_VALUE) return
      setValue(newValue)
    },
    [setValue],
  )

  const onMenuAction = React.useCallback(() => {}, [])

  return (
    <M.TableRow>
      <M.TableCell className={classes.inputCell}>
        <Cell
          {...{
            ...emptyKeyProps,
            columnPath,
            onExpand,
            onMenuAction,
            updateMyData: onChangeKey,
          }}
        />
      </M.TableCell>

      <M.TableCell className={classes.emptyCell}>
        <Cell
          {...{
            ...emptyValueProps,
            columnPath,
            onExpand,
            onMenuAction,
            updateMyData: onChangeValue,
          }}
        />
      </M.TableCell>
    </M.TableRow>
  )
}
