import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  content: {
    margin: t.spacing(1, 0, 0),
    padding: t.spacing(3, 4, 4),
  },
  input: {
    border: 0,
    width: '100%',
    fontFamily: (t.typography as any).monospace.fontFamily,
    fontSize: t.typography.body2.fontSize,
  },
}))

export function parseJSON(str: string) {
  try {
    return JSON.parse(str)
  } catch (e) {
    return str
  }
}

export const stringifyJSON = (obj: object | string) => {
  if (typeof obj === 'string') return obj
  return JSON.stringify(obj, null, 2)
}

interface QueryViewerProps {
  className: string
  onChange: (value: requests.ElasticSearchQuery) => void
  query: requests.ElasticSearchQuery | string
}

export default function QueryViewer({ className, query, onChange }: QueryViewerProps) {
  const classes = useStyles()

  if (!query) return null

  return (
    <div className={className}>
      <M.Typography variant="body1">Query body</M.Typography>
      <M.Paper className={classes.content}>
        <M.TextareaAutosize
          className={classes.input}
          value={stringifyJSON(query)}
          onChange={(e) => onChange(parseJSON(e.target.value))}
        />
      </M.Paper>
    </div>
  )
}
