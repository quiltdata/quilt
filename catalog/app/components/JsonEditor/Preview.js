import cx from 'classnames'
import isArray from 'lodash/isArray'
import isObject from 'lodash/isObject'
import isUndefined from 'lodash/isUndefined'
import * as React from 'react'
import * as M from '@material-ui/core'

import { isNestedType } from 'utils/json-schema'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'
import { COLUMN_IDS, EMPTY_VALUE } from './State'

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
  value: {
    flexGrow: 1,
    height: t.spacing(4),
    lineHeight: `${t.spacing(4) - 2}px`,
    marginRight: t.spacing(1),
    maxWidth: t.spacing(35),
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  placeholder: {
    color: t.palette.text.disabled,
  },
  required: {
    fontWeight: t.typography.fontWeightMedium,
  },
  menu: {
    marginLeft: 'auto',
  },
}))

function formatValuePreview(v) {
  if (v === EMPTY_VALUE || isUndefined(v)) return ''

  if (isArray(v)) {
    return `[ ${v.map(formatValuePreview).join(', ')} ]`
  }

  if (isObject(v)) {
    return `{ ${Object.keys(v).join(', ')} }`
  }

  if (v === null) {
    return 'null'
  }

  return v.toString()
}

function isExpandable(value, schema) {
  if (value !== EMPTY_VALUE) return isObject(value)

  return isNestedType(schema)
}

export default function Preview({
  columnId,
  data, // NOTE: row.original
  hasMenu,
  menuAnchorRef,
  placeholder,
  title,
  value,
  onExpand,
  onMenu,
}) {
  const classes = useStyles()

  const requiredKey = data.required && columnId === COLUMN_IDS.Key

  return (
    <div className={classes.root}>
      {isExpandable(value, data.valueSchema) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value} title={title}>
        <span
          className={cx(classes.valueInner, {
            [classes.required]: requiredKey,
            [classes.placeholder]: value === EMPTY_VALUE,
          })}
        >
          {formatValuePreview(value) || placeholder}
        </span>
      </div>

      <ButtonMenu
        ref={menuAnchorRef}
        className={classes.menu}
        note={<Note {...{ columnId, data, value }} />}
        hasMenu={hasMenu}
        onClick={onMenu}
      />
    </div>
  )
}
