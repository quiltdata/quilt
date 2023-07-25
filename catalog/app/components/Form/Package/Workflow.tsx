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

function getOptionLabel(option: WorkflowStruct) {
  if (option.name) return option.name
  if (option.slug === notAvailable || option.slug === notSelected) return 'None'
  return option.slug.toString()
}

const renderInput = (params: M.TextFieldProps, errorMessage: string) => (
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
)

const renderOption = (option: WorkflowStruct) => (
  <M.ListItemText primary={getOptionLabel(option)} secondary={option.description} />
)

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
  workflows: WorkflowStruct[]
  value: WorkflowStruct | null
  disabled?: boolean
}

function Workflow({
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

  const renderInputMemo = React.useCallback(
    (params) => renderInput(params, errorMessage),
    [errorMessage],
  )

  return (
    <Lab.Autocomplete
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      filterOptions={filterOptions}
      getOptionLabel={getOptionLabel}
      onChange={handleChange}
      options={workflows}
      disabled={disabled || value?.slug === notAvailable}
      renderInput={renderInputMemo}
      renderOption={renderOption}
      value={value}
    />
  )
}

interface WorkflowContainerProps extends Omit<WorkflowProps, 'workflows'> {
  workflows: WorkflowStruct[] | typeof L | Error
}

export default function WorkflowContainer({
  workflows,
  ...props
}: WorkflowContainerProps) {
  const classes = useStyles()

  if (workflows === L) return <InputSkeleton />
  if (workflows instanceof Error) {
    return (
      <Lab.Alert className={classes.alert} severity="error">
        {workflows.message}
      </Lab.Alert>
    )
  }

  return <Workflow workflows={workflows} {...props} />
}
