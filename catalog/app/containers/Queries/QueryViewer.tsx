import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles({
  root: {},
})

interface QueryViewerProps {
  value: string
}

export default function QueryViewer({ value }: QueryViewerProps) {
  const classes = useStyles()

  const query = JSON.parse(value)

  return (
    <JsonDisplay
      value={query}
      name={undefined}
      topLevel
      defaultExpanded
      className={classes.root}
    />
  )
}
