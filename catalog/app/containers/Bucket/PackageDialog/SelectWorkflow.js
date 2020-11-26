import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'

const useStyles = M.makeStyles((t) => ({
  crop: {
    textOverflow: 'ellipsis',
    overflow: 'hidden',
  },
  error: {
    marginRight: t.spacing(1),
  },
  spinner: {
    flex: 'none',
    marginRight: t.spacing(3),
  },
}))

export default function SelectWorkflow({
  className,
  disabled,
  error,
  items,
  onChange,
  value,
}) {
  const classes = useStyles()

  const noChoice = items.length === 1

  return (
    <M.FormControl
      className={className}
      disabled={disabled || noChoice}
      fullWidth
      size="small"
      error={!!error}
    >
      <M.InputLabel id="schema-select">Metadata quality workflow</M.InputLabel>
      <M.Select
        labelId="schema-select"
        value={value ? value.slug.toString() : ''}
        label="Metadata quality workflow"
      >
        {items.map((option) => (
          <M.MenuItem
            key={option.slug.toString()}
            value={option.slug.toString()}
            onClick={() => onChange(option)}
            dense
          >
            <M.ListItemText
              classes={{
                primary: classes.crop,
                secondary: classes.crop,
              }}
              primary={option.name || 'None'}
              secondary={option.description}
            />
          </M.MenuItem>
        ))}
      </M.Select>
      <M.FormHelperText>
        {error && <span className={classes.error}>{error}</span>}
        <M.Link href={`${docs}/advanced-usage/workflows`} target="_blank">
          Learn about quality workflows
        </M.Link>
      </M.FormHelperText>
    </M.FormControl>
  )
}
