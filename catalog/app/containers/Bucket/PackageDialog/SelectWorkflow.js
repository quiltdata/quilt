import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import * as workflows from 'utils/workflows'

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

export default function SelectWorkflow({ disabled, error, items, onChange, value }) {
  const classes = useStyles()

  const noChoice = items.length === 1

  return (
    <M.FormControl disabled={disabled || noChoice} fullWidth size="small" error={!!error}>
      <M.InputLabel id="schema-select" shrink>
        Workflow
      </M.InputLabel>
      <M.Select
        labelId="schema-select"
        value={value ? value.slug.toString() : workflows.notSelected.toString()}
      >
        {items.map((workflow) => (
          <M.MenuItem
            key={workflow.slug.toString()}
            value={workflow.slug.toString()}
            onClick={() => !workflow.isDisabled && onChange(workflow)}
            disabled={workflow.isDisabled}
            dense
          >
            <M.ListItemText
              classes={{
                primary: classes.crop,
                secondary: classes.crop,
              }}
              primary={workflow.name || 'None'}
              secondary={workflow.description}
            />
          </M.MenuItem>
        ))}
      </M.Select>
      <M.FormHelperText>
        {!!error && <span className={classes.error}>{error}</span>}
        <M.Link href={`${docs}/advanced/workflows`} target="_blank">
          Learn about quality workflows
        </M.Link>
      </M.FormHelperText>
    </M.FormControl>
  )
}
