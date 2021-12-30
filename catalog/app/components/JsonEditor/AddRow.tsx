import * as React from 'react'
import * as M from '@material-ui/core'

import Cell from './Cell'
import { COLUMN_IDS, EMPTY_VALUE, JsonValue } from './constants'

const useStyles = M.makeStyles((t) => ({
  inputCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(27),
    },
  },
  emptyCell: {
    border: `1px solid ${t.palette.grey[400]}`,
    padding: 0,
    width: '50%',
    [t.breakpoints.up('lg')]: {
      width: t.spacing(40),
    },
  },
}))

const emptyKeyProps = {
  column: {
    id: COLUMN_IDS.KEY,
  },
  row: {
    original: {
      address: [],
      errors: [],
      required: false,
      sortIndex: -1,
      type: 'undefined',
      valueSchema: undefined,
      updateMyData: () => {},
    },
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
    original: {
      address: [],
      errors: [],
      required: false,
      sortIndex: -1,
      type: 'undefined',
      valueSchema: undefined,
      updateMyData: () => {},
    },
    values: {
      [COLUMN_IDS.KEY]: EMPTY_VALUE,
      [COLUMN_IDS.VALUE]: EMPTY_VALUE,
    },
  },
  value: EMPTY_VALUE,
}

interface AddRowProps {
  columnPath: string[]
  onAdd: (path: string[], key: string, value: JsonValue) => void
  onExpand: (path: string[]) => void
}

export default function AddRow({ columnPath, onAdd, onExpand }: AddRowProps) {
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

  const onRemove = React.useCallback(() => {}, [])

  return (
    <M.TableRow>
      <M.TableCell className={classes.inputCell}>
        <Cell
          {...{
            ...emptyKeyProps,
            columnPath,
            editing: false,
            onExpand,
            onRemove,
            updateMyData: onChangeKey,
          }}
        />
      </M.TableCell>

      <M.TableCell className={classes.emptyCell}>
        <Cell
          {...{
            ...emptyValueProps,
            columnPath,
            editing: false,
            onExpand,
            onRemove,
            updateMyData: onChangeValue,
          }}
        />
      </M.TableCell>
    </M.TableRow>
  )
}
