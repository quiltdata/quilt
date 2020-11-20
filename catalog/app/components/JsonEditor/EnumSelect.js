import * as React from 'react'
import * as M from '@material-ui/core'

import Note from './Note'
import { EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    height: t.spacing(4),
    position: 'relative',
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

  icon: {
    right: t.spacing(6),
  },

  placeholder: {
    lineHeight: `${t.spacing(4) - 2}px`,
    color: t.palette.text.disabled,
    left: t.spacing(1),
    position: 'absolute',
  },
}))

export default function EnumSelect({ columnId, data, placeholder, value, onChange }) {
  const classes = useStyles()

  const options = React.useMemo(
    () =>
      data.valueSchema.enum.map((item) => ({
        title: item,
      })),
    [data],
  )

  const onChangeInternal = (e) => {
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
          <M.MenuItem key={menuItem.title} value={menuItem.title}>
            {menuItem.title}
          </M.MenuItem>
        ))}
      </M.Select>

      {value === EMPTY_VALUE && (
        <span className={classes.placeholder}>{placeholder}</span>
      )}
    </div>
  )
}
