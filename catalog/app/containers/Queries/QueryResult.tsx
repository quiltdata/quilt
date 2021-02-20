import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

const useStyles = M.makeStyles({
  root: {},
})

interface QueryResultProps {
  value: {}
}

export default function QueryResult({ value }: QueryResultProps) {
  const classes = useStyles()

  return (
    <JsonDisplay
      value={value}
      name={undefined}
      topLevel
      defaultExpanded
      className={classes.root}
    />
  )
}
