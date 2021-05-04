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

export function getOptions(items) {
  const options = items.map((item) => ({
    key: item.slug.toString(),
    label: item.name || 'None',
    description: item.description,
  }))

  const showDisabledNoneOption = !items.find(({ slug }) => slug === workflows.notSelected)
  if (showDisabledNoneOption) {
    options.unshift({
      key: workflows.notSelected.toString(),
      label: 'None',
      disabled: true,
    })
  }

  return options
}

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
            onClick={() => !disabled && onChange(option)}
            dense
          >
            <M.ListItemText
              classes={{
                primary: classes.crop,
                secondary: classes.crop,
              }}
              primary={option.name}
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
