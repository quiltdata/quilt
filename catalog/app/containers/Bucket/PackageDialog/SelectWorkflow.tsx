import * as React from 'react'
import * as M from '@material-ui/core'

import { WorkflowsConfigLink } from 'components/FileEditor/HelpLinks'
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
  text: {
    marginTop: 0,
    marginBottom: 0,
  },
}))

interface SelectWorkflowProps {
  disabled?: boolean
  error?: React.ReactNode
  items: workflows.Workflow[]
  onChange: (v: workflows.Workflow) => void
  value?: workflows.Workflow
}

export default function SelectWorkflow({
  disabled,
  error,
  items,
  onChange,
  value,
}: SelectWorkflowProps) {
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
              className={classes.text}
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
        <M.Link href={`${docs}/workflows`} target="_blank">
          Learn about data quality workflows
        </M.Link>
        , or edit <WorkflowsConfigLink>your workflows config file</WorkflowsConfigLink>
      </M.FormHelperText>
    </M.FormControl>
  )
}
