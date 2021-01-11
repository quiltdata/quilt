import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { isNestedType } from 'utils/json-schema'

import ButtonExpand from './ButtonExpand'
import ButtonMenu from './ButtonMenu'
import Note from './Note'
import PreviewValue from './PreviewValue'
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

const isExpandable = (value, schema) =>
  value === EMPTY_VALUE ? isNestedType(schema) : R.is(Object, value)

export default function Preview({
  columnId,
  data, // NOTE: react-table's row.original
  menu,
  menuOpened,
  onExpand,
  onMenu,
  onMenuClose,
  onMenuSelect,
  placeholder,
  title,
  value,
}) {
  const classes = useStyles()

  const requiredKey = data.required && columnId === COLUMN_IDS.KEY
  const isEmpty = React.useMemo(() => value === EMPTY_VALUE, [value])

  return (
    <div className={classes.root}>
      {isExpandable(value, data.valueSchema) && <ButtonExpand onClick={onExpand} />}

      <div className={classes.value} title={title}>
        <span
          className={cx(classes.valueInner, {
            [classes.required]: requiredKey,
            [classes.placeholder]: isEmpty,
          })}
        >
          {isEmpty ? placeholder : <PreviewValue value={value} />}
        </span>
      </div>

      <ButtonMenu
        className={classes.menu}
        menu={menu}
        menuOpened={menuOpened}
        note={<Note {...{ columnId, data, value }} />}
        onClick={onMenu}
        onMenuClose={onMenuClose}
        onMenuSelect={onMenuSelect}
      />
    </div>
  )
}
