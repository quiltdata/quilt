import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

import { EMPTY_VALUE } from './State'

const useStyles = M.makeStyles((t) => ({
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
}))

function PreviewArray({ value }) {
  const classes = useStyles()

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

export default function PreviewValue({ value }) {
  const classes = useStyles()

  if (value === EMPTY_VALUE || value === undefined) return ''

  if (Array.isArray(value)) return <PreviewArray value={value} />

  if (R.is(Object, value)) {
    return (
      <span>
        <span className={classes.lbrace}>&#123;</span>
        {Object.keys(value).join(', ')}
        <span className={classes.rbrace}>&#125;</span>
      </span>
    )
  }

  if (value === null) return 'null'

  if (R.is(String, value)) return <span>&quot;{value}&quot;</span>

  return value.toString()
}
