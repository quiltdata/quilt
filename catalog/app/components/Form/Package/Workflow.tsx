import cx from 'classnames'
import * as React from 'react'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

import L from 'constants/loading'
import { Workflow as WorkflowStruct, notAvailable, notSelected } from 'utils/workflows'

import InputSkeleton from './InputSkeleton'

const filterOptions = Lab.createFilterOptions({
  stringify: (option: WorkflowStruct) => JSON.stringify(option),
})

const useStyles = M.makeStyles((t) => ({
  alert: {
    height: '70px',
  },
  noHelperText: {
    paddingBottom: t.spacing(3),
  },
}))
function getOptionLabel(option: WorkflowStruct) {
  if (option.name) return option.name
  if (option.slug === notAvailable || option.slug === notSelected) return 'None'
  return option.slug.toString()
}

interface WorkflowProps {
  className?: string
  errors?: Error[]
  onChange: (v: WorkflowStruct | null) => void
  workflows: WorkflowStruct[] | typeof L | Error
  value: WorkflowStruct | null
  disabled?: boolean
}

export default function Workflow({
  className,
  errors = [],
  onChange,
  workflows,
  value,
  disabled = false,
}: WorkflowProps) {
  const classes = useStyles()
  const handleChange = React.useCallback(
    (__e, newValue: WorkflowStruct | null) => onChange(newValue),
    [onChange],
  )
  const errorMessage = errors.map(({ message }) => message).join('; ')
  if (workflows === L) return <InputSkeleton />
  if (workflows instanceof Error) {
    return (
      <Lab.Alert className={classes.alert} severity="error">
        {workflows.message}
      </Lab.Alert>
    )
  }
  return (
    <Lab.Autocomplete
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      filterOptions={filterOptions}
      getOptionLabel={getOptionLabel}
      onChange={handleChange}
      options={workflows}
      disabled={disabled || value?.slug === notAvailable}
      renderInput={(params) => (
        <M.TextField
          {...params}
          fullWidth
          label="Workflow"
          placeholder="Workflow"
          InputLabelProps={{
            shrink: true,
          }}
          helperText={errorMessage}
          error={!!errorMessage}
        />
      )}
      renderOption={(option) => (
        <M.ListItemText primary={getOptionLabel(option)} secondary={option.description} />
      )}
      value={value}
    />
  )
}
