import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import Note from './Note'
import PreviewValue from './PreviewValue'
import { JsonValue, EMPTY_VALUE, RowData } from './constants'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(4),
    position: 'relative',
  },
  icon: {
    right: t.spacing(6),
  },
  placeholder: {
    color: t.palette.text.disabled,
    left: t.spacing(1),
    lineHeight: `${t.spacing(4) - 2}px`,
    position: 'absolute',
  },
  select: {
    ...t.typography.body2,
    padding: t.spacing(0, 1),
    width: '100%',
    zIndex: 1,
    '&:focus': {
      outline: `2px solid ${t.palette.primary.light}`,
    },
  },
}))

interface EnumSelectProps {
  columnId: 'key' | 'value'
  data: RowData
  placeholder: string
  value: JsonValue
  onChange: (value: JsonValue) => void
}

export default function EnumSelect({
  columnId,
  data,
  placeholder,
  value,
  onChange,
}: EnumSelectProps) {
  const classes = useStyles()

  if (!data?.valueSchema?.enum) throw new Error('This is not enum')

  const options = React.useMemo(
    () =>
      data.valueSchema!.enum!.map((enumItem: JsonValue, index: number) => ({
        value: R.equals(value, enumItem) ? value : enumItem,
        key: index,
      })),
    [data, value],
  )

  const onChangeInternal = (
    e: React.ChangeEvent<{ name?: string; value: JsonValue }>,
  ) => {
    if (e.target.value === undefined) {
      onChange(EMPTY_VALUE)
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <div className={classes.root}>
      <M.Select
        className={classes.select}
        value={value === EMPTY_VALUE ? '' : value}
        onChange={onChangeInternal}
        classes={{
          icon: classes.icon,
        }}
        input={<M.InputBase endAdornment={<Note {...{ columnId, data, value }} />} />}
      >
        {options.map((menuItem) => (
          <M.MenuItem key={menuItem.key} value={menuItem.value}>
            <PreviewValue value={menuItem.value} />
          </M.MenuItem>
        ))}
      </M.Select>

      {value === EMPTY_VALUE && (
        <span className={classes.placeholder}>{placeholder}</span>
      )}
    </div>
  )
}
