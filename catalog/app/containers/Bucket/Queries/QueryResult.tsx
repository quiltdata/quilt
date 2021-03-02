import * as React from 'react'
import * as M from '@material-ui/core'

import JsonDisplay from 'components/JsonDisplay'

import * as requests from './requests'

const useStyles = M.makeStyles((t) => ({
  content: {
    margin: t.spacing(1, 0, 0),
    padding: t.spacing(3, 4, 4),
  },
}))

interface QueryResultProps {
  className: string
  results: requests.ElasticSearchResults
}

export default function QueryResult({ className, results }: QueryResultProps) {
  const classes = useStyles()

  return (
    <div className={className}>
      <M.Typography variant="body1">Search results</M.Typography>
      <M.Paper className={classes.content}>
        <JsonDisplay
          className=""
          value={results}
          name={undefined}
          topLevel
          defaultExpanded
        />
      </M.Paper>
    </div>
  )
}
