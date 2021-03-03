import * as React from 'react'
import * as M from '@material-ui/core'

import JsonEditor from 'components/JsonEditor'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  editor: {
    margin: t.spacing(1, 0, 0),
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

  const JE = JsonEditor as $TSFixMe

  return (
    <div className={className}>
      <M.Typography variant="body1">Query body</M.Typography>
      <JE className={classes.editor} onChange={onChange} value={query} />
    </div>
  )
}
