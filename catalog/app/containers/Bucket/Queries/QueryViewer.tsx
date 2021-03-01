import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles((t) => ({
  content: {
    margin: t.spacing(1, 0, 0),
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryViewerProps {
  className: string
  query: object | null
}

export default function QueryViewer({ className, query }: QueryViewerProps) {
  const classes = useStyles()

  if (!query) return null

  return (
    <div className={className}>
      <M.Typography variant="body1">Query body</M.Typography>
      <M.Paper className={classes.content}>
        <JsonDisplay
          className=""
          value={query}
          name={undefined}
          topLevel
          defaultExpanded
        />
      </M.Paper>
    </div>
  )
}
