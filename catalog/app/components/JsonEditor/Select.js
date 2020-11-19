import * as React from 'react'
import * as M from '@material-ui/core'

import Note from './Note'
import { EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    ...t.typography.body2,
    padding: t.spacing(0, 1),
    position: 'relative',
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
    color: t.palette.text.disabled,
  },
}))

// TODO: disabled MenuItem for required
// FIXME: Show placeholder

export default function Select({ menu, columnId, data, value, onChange }) {
  const classes = useStyles()

  const onChangeInternal = (e) => {
    if (e.target.value === undefined) {
      onChange(EMPTY_VALUE)
    } else {
      onChange(e.target.value)
    }
  }

  return (
    <M.Select
      className={classes.root}
      value={value === EMPTY_VALUE ? '' : value}
      onChange={onChangeInternal}
      classes={{
        icon: classes.icon,
      }}
      inputProps={{
        placeholder: 'LTINTIFWETN FT NWY',
      }}
      input={
        <M.InputBase
          endAdornment={<Note {...{ columnId, data, value }} />}
          /* value={value === EMPTY_VALUE ? '' : value} */
          placeholder="PLACEHOLDER"
        />
      }
    >
      <M.MenuItem value="">None</M.MenuItem>
      {menu[0].options.map((menuItem) => (
        <M.MenuItem key={menuItem.title} value={menuItem.title}>
          {menuItem.title}
        </M.MenuItem>
      ))}
    </M.Select>
  )
}
