import * as React from 'react'
import * as M from '@material-ui/core'

import * as JSONPointer from 'utils/JSONPointer'

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
      key: '',
      reactId: '',
      required: false,
      sortIndex: -1,
      type: 'undefined',
      updateMyData: () => {},
      value: '',
      valueSchema: undefined,
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
      key: '',
      reactId: '',
      required: false,
      sortIndex: -1,
      type: 'undefined',
      updateMyData: () => {},
      value: '',
      valueSchema: undefined,
    },
    values: {
      [COLUMN_IDS.KEY]: EMPTY_VALUE,
      [COLUMN_IDS.VALUE]: EMPTY_VALUE,
    },
  },
  value: EMPTY_VALUE,
}

interface AddRowProps {
  columnPath: JSONPointer.Path
  contextMenuPath: JSONPointer.Path
  onAdd: (path: JSONPointer.Path, key: string, value: JsonValue) => void
  onContextMenu: (path: JSONPointer.Path) => void
  onExpand: (path: JSONPointer.Path) => void
}

export default function AddRow({
  columnPath,
  contextMenuPath,
  onAdd,
  onContextMenu,
  onExpand,
}: AddRowProps) {
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
            contextMenuPath,
            editing: false,
            onContextMenu,
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
            contextMenuPath,
            editing: false,
            onContextMenu,
            onExpand,
            onRemove,
            updateMyData: onChangeValue,
          }}
        />
      </M.TableCell>
    </M.TableRow>
  )
}
