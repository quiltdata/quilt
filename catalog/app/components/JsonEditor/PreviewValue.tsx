import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { JsonValue, EMPTY_VALUE } from './constants'
import { stringifyJSON } from './utils'

const useArrayStyles = M.makeStyles((t) => ({
  lbracket: {
    color: t.palette.secondary.dark,
    marginRight: t.spacing(0.5),
  },
  rbracket: {
    color: t.palette.secondary.dark,
    marginLeft: t.spacing(0.5),
  },
}))

const useObjectStyles = M.makeStyles((t) => ({
  lbrace: {
    color: t.palette.secondary.dark,
    marginRight: t.spacing(0.5),
  },
  rbrace: {
    color: t.palette.secondary.dark,
    marginLeft: t.spacing(0.5),
  },
}))

interface PreviewArrayProps {
  value: JsonValue[]
}

function PreviewArray({ value }: PreviewArrayProps) {
  const classes = useArrayStyles()

  const items = React.useMemo(
    () =>
      value.map((item, index) => ({
        key: `${item}+${index}`,
        value: item,
        hasDelimiter: index < value.length - 1,
      })),
    [value],
  )

  return (
    <span>
      <span className={classes.lbracket}>[</span>
      {items.map((item) => (
        <span key={item.key}>
          <PreviewValue value={item.value} />
          {item.hasDelimiter && ', '}
        </span>
      ))}
      <span className={classes.rbracket}>]</span>
    </span>
  )
}

interface PreviewObjectProps {
  value: JsonValue
}

function PreviewObject({ value }: PreviewObjectProps) {
  const classes = useObjectStyles()

  const hintText = React.useMemo(() => stringifyJSON(value), [value])

  return (
    <M.Tooltip title={hintText}>
      <span>
        <span className={classes.lbrace}>&#123;</span>
        {Object.keys(value).join(', ')}
        <span className={classes.rbrace}>&#125;</span>
      </span>
    </M.Tooltip>
  )
}

interface PreviewValueProps {
  value: JsonValue
  fallback?: React.ReactNode
  strQuot?: string
}

export default function PreviewValue({
  value,
  fallback = '',
  strQuot = '"',
}: PreviewValueProps) {
  if (value === EMPTY_VALUE || value === undefined) return fallback

  if (Array.isArray(value)) return <PreviewArray value={value} />

  if (R.is(Object, value)) return <PreviewObject value={value} />

  if (value === null) return 'null'

  if (R.is(String, value)) {
    return (
      <span>
        {strQuot}
        {value}
        {strQuot}
      </span>
    )
  }

  return value.toString()
}
