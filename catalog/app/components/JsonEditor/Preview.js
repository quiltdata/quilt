import * as React from 'react'
import cx from 'classnames'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'
import isUndefined from 'lodash/isUndefined'

import * as M from '@material-ui/core'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'
import { ColumnIds } from './State'

const useStyles = M.makeStyles((t) => ({
  root: {
    alignItems: 'center',
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

  required: {
    fontWeight: t.typography.fontWeightMedium,
  },

  placeholder: {
    color: t.palette.text.disabled,
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

  return isUndefined(x) ? '' : x.toString()
}

export default function Preview({
  columnId,
  data, // NOTE: row.original
  menuAnchorRef,
  value,
  onExpand,
  onMenu,
}) {
  const classes = useStyles()

  const requiredKey = data.required && columnId === ColumnIds.Key
  const placeholderValue = data.empty && columnId === ColumnIds.Value

  return (
    <div className={classes.root}>
      {isObject(value) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value}>
        <span
          className={cx(classes.valueInner, {
            [classes.required]: requiredKey,
            [classes.placeholder]: placeholderValue,
          })}
        >
          {formatValuePreview(value)}
        </span>
      </div>

      <ButtonMenu
        ref={menuAnchorRef}
        className={classes.menu}
        note={<Note {...{ columnId, data, value }} />}
        valueType={data.valueType}
        onClick={onMenu}
      />
    </div>
  )
}
