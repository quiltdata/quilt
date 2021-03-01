import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  queries: requests.Query[]
  onChange: (value: requests.Query | null) => void
  value: requests.Query | null
}

const useStyles = M.makeStyles({
  root: {
    width: '100%',
  },
})

export default function QuerySelect({
  className,
  queries,
  onChange,
  value,
}: QuerySelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      onChange(queries.find((query) => query.key === event.target.value) || null)
    },
    [queries, onChange],
  )

  return (
    <div className={className}>
      <M.Typography variant="body1">Select query</M.Typography>
      <M.FormControl className={classes.root}>
        <M.Select
          labelId="query-select"
          value={value ? value.key : ''}
          onChange={handleChange}
        >
          {queries.map((query) => (
            <M.MenuItem key={query.key} value={query.key}>
              {query.name}
            </M.MenuItem>
          ))}
        </M.Select>
      </M.FormControl>
    </div>
  )
}
