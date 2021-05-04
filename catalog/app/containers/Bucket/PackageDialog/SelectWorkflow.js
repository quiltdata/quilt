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

// interface UiOptions {
//   key: string
//   label: string
//   description?: string
//   workflow?: workflows.Workflow
// }

export function getOptions(items) {
  const options = items.map((workflow) => ({
    key: workflow.slug.toString(),
    label: workflow.name || 'None',
    description: workflow.description,
    workflow,
  }))

  const showDisabledNoneOption = !items.find(({ slug }) => slug === workflows.notSelected)
  if (showDisabledNoneOption) {
    options.unshift({
      key: workflows.notSelected.toString(),
      label: 'None',
    })
  }

  return options
}

// interface SelectWorkflowProps {
//   className: string
//   disabled?: boolean
//   error: Error
//   items: workflows.Workflow[]
//   onChange: (w: workflows.Workflow) => void
//   value: workflows.Workflow
// }

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
  const options = React.useMemo(() => getOptions(items), [items])

  return (
    <M.FormControl
      className={className}
      disabled={disabled || noChoice}
      fullWidth
      size="small"
      error={!!error}
    >
      <M.InputLabel id="schema-select" shrink>
        Workflow
      </M.InputLabel>
      <M.Select
        labelId="schema-select"
        value={value ? value.slug.toString() : workflows.notSelected.toString()}
      >
        {options.map((option) => (
          <M.MenuItem
            key={option.key}
            value={option.key}
            onClick={() => !!option.workflow && onChange(option.workflow)}
            disabled={!option.workflow}
            dense
          >
            <M.ListItemText
              classes={{
                primary: classes.crop,
                secondary: classes.crop,
              }}
              primary={option.label}
              secondary={option.description}
            />
          </M.MenuItem>
        ))}
      </M.Select>
      <M.FormHelperText>
        {!!error && <span className={classes.error}>{error}</span>}
        <M.Link href={`${docs}/advanced-usage/workflows`} target="_blank">
          Learn about quality workflows
        </M.Link>
      </M.FormHelperText>
    </M.FormControl>
  )
}
