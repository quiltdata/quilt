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

const usePreviewValueStyles = M.makeStyles((t) => ({
  lbrace: {
    color: t.palette.secondary.dark,
    marginRight: t.spacing(0.5),
  },
  rbrace: {
    color: t.palette.secondary.dark,
    marginLeft: t.spacing(0.5),
  },
  lbracket: {
    color: t.palette.secondary.dark,
    marginRight: t.spacing(0.5),
  },
  rbracket: {
    color: t.palette.secondary.dark,
    marginLeft: t.spacing(0.5),
  },
  quote: {
    color: t.palette.text.secondary,
  },
}))

function PreviewArray({ value }) {
  const classes = usePreviewValueStyles()

  return (
    <span>
      <span className={classes.lbracket}>[</span>
      {value.map((v, index) => (
        // eslint-disable-next-line react/no-array-index-key
        <span key={`${v}+${index}`}>
          <PreviewValue value={v} />
          {index < value.length - 1 && ', '}
        </span>
      ))}
      <span className={classes.rbracket}>]</span>
    </span>
  )
}

function PreviewValue({ value }) {
  const classes = usePreviewValueStyles()

  if (value === EMPTY_VALUE || isUndefined(value)) return ''

  if (isArray(value)) return <PreviewArray value={value} />

  if (isObject(value)) {
    return (
      <span>
        <span className={classes.lbrace}>&#123;</span>
        {Object.keys(value).join(', ')}
        <span className={classes.rbrace}>&#125;</span>
      </span>
    )
  }

  if (value === null) return 'null'

  if (typeof value === 'string') {
    return (
      <span>
        <span className={classes.quote}>&quot;</span>
        {value}
        <span className={classes.quote}>&quot;</span>
      </span>
    )
  }

  return value.toString()
}

const isExpandable = (value, schema) =>
  value === EMPTY_VALUE ? isNestedType(schema) : isObject(value)

export default function Preview({
  columnId,
  data, // NOTE: react-table's row.original
  hasMenu,
  menuAnchorRef,
  placeholder,
  title,
  value,
  onExpand,
  onMenu,
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
        ref={menuAnchorRef}
        className={classes.menu}
        note={<Note {...{ columnId, data, value }} />}
        hasMenu={hasMenu}
        onClick={onMenu}
      />
    </div>
  )
}
