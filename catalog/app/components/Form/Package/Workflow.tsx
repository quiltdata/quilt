import cx from 'classnames'
import * as React from 'react'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

import type { Workflow as WorkflowStruct } from 'utils/workflows'

import InputSkeleton from './InputSkeleton'
import { L } from './types'

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

interface WorkflowProps {
  className?: string
  errors?: Error[]
  onChange: (v: WorkflowStruct | null) => void
  workflows: WorkflowStruct[] | typeof L | Error
  value: WorkflowStruct | null
}

export default function Workflow({
  className,
  errors = [],
  onChange,
  workflows,
  value,
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
      getOptionLabel={(option) => option.name || option.slug.toString()}
      onChange={handleChange}
      options={workflows}
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
        <M.ListItemText
          primary={option.name ? option.name : option.slug}
          secondary={option.description}
        />
      )}
      value={value}
    />
  )
}
