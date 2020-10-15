import * as React from 'react'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'

import * as M from '@material-ui/core'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
    borderRight: `1px solid ${t.palette.divider}`,
    display: 'flex',
    height: t.spacing(6),
    padding: t.spacing(1),
    position: 'relative',
    width: '100%',
  },

  value: {
    flexGrow: 1,
    fontSize: '1rem',
    marginRight: t.spacing(1),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    maxWidth: t.spacing(35),
  },

  menu: {
    marginLeft: 'auto',
  },
}))

function formatValuePreview(x) {
  if (isArray(x)) {
    return `[ ${x.map(formatValuePreview)} ]`
  }

  if (isObject(x)) {
    return `{ ${Object.keys(x).join(', ')} }`
  }

  return x
}

export default function Preview({
  columnId,
  data,
  menuAnchorRef,
  value,
  onExpand,
  onMenu,
}) {
  const classes = useStyles()

  return (
    <div className={classes.root}>
      {isObject(value) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value}>
        <span className={classes.valueInner}>{formatValuePreview(value)}</span>
      </div>

      <ButtonMenu
        ref={menuAnchorRef}
        className={classes.menu}
        note={<Note {...{ columnId, data, value }} />}
        onClick={onMenu}
      />
    </div>
  )
}
