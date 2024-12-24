import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonSchema, isNestedType } from 'utils/JSONSchema'

import ButtonExpand from './ButtonExpand'
import Note from './Note'
import PreviewValue from './PreviewValue'
import {
  COLUMN_IDS,
  EMPTY_VALUE,
  JSON_POINTER_PLACEHOLDER,
  JsonValue,
  RowData,
} from './constants'

const useStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    alignItems: 'center',
    display: 'flex',
    height: t.spacing(4),
    lineHeight: `${t.spacing(4)}px`,
    padding: t.spacing(0, 1),
    position: 'relative',
    width: '100%',
  },
  button: {
    opacity: 0.3,
    '&:hover': {
      opacity: 1,
    },
  },
  value: {
    flexGrow: 1,
    height: t.spacing(4),
    lineHeight: `${t.spacing(4) - 2}px`,
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  placeholder: {
    color: t.palette.text.disabled,
  },
  required: {
    fontWeight: t.typography.fontWeightBold,
  },
  menu: {
    marginLeft: 'auto',
  },
}))

const isExpandable = (value: JsonValue, schema?: JsonSchema) =>
  value === EMPTY_VALUE ? isNestedType(schema) : R.is(Object, value)

const hasDeleteButton = (columnId: 'key' | 'value', value: JsonValue, data: RowData) => {
  // Remove button is shown in key field
  if (columnId !== COLUMN_IDS.KEY) return false
  // Remove button is shown only when key is set
  if (value === EMPTY_VALUE) return false
  // No button if key is a placeholder from Schema,
  // but not a placeholder for key in arrays (via `items`) or maps (via `additionalProperties`)
  if (data.valueSchema && R.last(data.address) !== JSON_POINTER_PLACEHOLDER) return false
  return true
}

interface PreviewProps {
  columnId: 'key' | 'value'
  data: RowData // NOTE: react-table's row.original
  onContextMenu: React.MouseEventHandler<HTMLElement>
  onExpand: () => void
  onRemove: () => void
  placeholder: string
  title: string
  value: JsonValue
}

export default function Preview({
  columnId,
  data,
  onContextMenu,
  onExpand,
  onRemove,
  placeholder,
  title,
  value,
}: PreviewProps) {
  const classes = useStyles()

  const requiredKey = data.required && columnId === COLUMN_IDS.KEY
  const isEmpty = React.useMemo(() => value === EMPTY_VALUE, [value])

  return (
    <div className={classes.root} onContextMenu={onContextMenu}>
      {isExpandable(value, data.valueSchema) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value} title={title}>
        <span
          className={cx({
            [classes.required]: requiredKey,
            [classes.placeholder]: isEmpty,
          })}
        >
          {isEmpty ? placeholder : <PreviewValue value={value} />}
        </span>
      </div>

      <Note {...{ columnId, data, value }} />

      {hasDeleteButton(columnId, value, data) && (
        <M.IconButton
          className={classes.button}
          onClick={onRemove}
          size="small"
          title="Remove"
        >
          <M.Icon fontSize="small">delete</M.Icon>
        </M.IconButton>
      )}
    </div>
  )
}
