import * as React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import * as requests from './requests'

interface QuerySelectProps {
  className: string
  config: requests.ConfigData
  onChange: (value: requests.Query | null) => void
  value: requests.Query | null
}

interface QuerySelectSkeletonProps {
  className: string
}

function QuerySelectSkeleton({ className }: QuerySelectSkeletonProps) {
  return <M.CircularProgress className={className} size={96} />
}

const useStyles = M.makeStyles({
  root: {
    width: '100%',
  },
})

export default function QuerySelect({
  className,
  config,
  onChange,
  value,
}: QuerySelectProps) {
  const classes = useStyles()

  const handleChange = React.useCallback(
    (event) => {
      onChange(config.value.find((query) => query.key === event.target.value) || null)
    },
    [config, onChange],
  )

  if (config.error) return <Lab.Alert severity="error">{config.error.message}</Lab.Alert>

  if (config.loading) return <QuerySelectSkeleton className={className} />

  return (
    <div className={className}>
      <M.Typography variant="body1">Select query</M.Typography>
      <M.FormControl className={classes.root}>
        <M.Select
          labelId="query-select"
          value={value ? value.key : ''}
          onChange={handleChange}
        >
          {config.value.map((query) => (
            <M.MenuItem key={query.key} value={query.key}>
              {query.name}
            </M.MenuItem>
          ))}
        </M.Select>
      </M.FormControl>
    </div>
  )
}
