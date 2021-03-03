import * as React from 'react'
import * as M from '@material-ui/core'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  queries: requests.Query[]
  onChange: (value: requests.Query | null) => void
  value: requests.Query | null
}

const useStyles = M.makeStyles((t) => ({
  header: {
    margin: t.spacing(0, 0, 1),
  },
  selectWrapper: {
    width: '100%',
  },
  select: {
    padding: t.spacing(1),
  },
}))

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
      <M.Typography className={classes.header} variant="body1">
        Select query
      </M.Typography>
      <M.Paper>
        <M.FormControl className={classes.selectWrapper}>
          <M.Select
            labelId="query-select"
            value={value ? value.key : 'none'}
            onChange={handleChange}
            classes={{ root: classes.select }}
          >
            <M.MenuItem disabled value="none">
              None
            </M.MenuItem>
            {queries.map((query) => (
              <M.MenuItem key={query.key} value={query.key}>
                {query.name}
              </M.MenuItem>
            ))}
          </M.Select>
        </M.FormControl>
      </M.Paper>
    </div>
  )
}
