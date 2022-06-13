import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonSchema, isNestedType } from 'utils/json-schema'

import ButtonExpand from './ButtonExpand'
import Note from './Note'
import PreviewValue from './PreviewValue'
import { JsonValue, COLUMN_IDS, EMPTY_VALUE, RowData } from './constants'

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

const hasDeleteButton = (
  columnId: 'key' | 'value',
  value: JsonValue,
  schema?: JsonSchema,
) => columnId === COLUMN_IDS.KEY && !schema && value !== EMPTY_VALUE

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

      {hasDeleteButton(columnId, value, data.valueSchema) && (
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
