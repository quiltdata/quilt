import cx from 'classnames'
import * as React from 'react'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

import Skel from 'components/Skeleton'
import * as workflows from 'utils/workflows'

import { L } from './types'

const useSkeletonStyles = M.makeStyles({
  label: {
    height: '12px',
    width: '100px',
  },
  input: {
    height: '32px',
    margin: '6px 0',
  },
  helperText: {
    height: '18px',
    width: '50%',
  },
})

interface SkeletonProps {
  className?: string
}

function Skeleton({ className }: SkeletonProps) {
  const classes = useSkeletonStyles()
  return (
    <div className={className}>
      <Skel className={classes.label} animate />
      <Skel className={classes.input} animate />
      <Skel className={classes.helperText} animate />
    </div>
  )
}

const filterOptions = Lab.createFilterOptions({
  stringify: (option: workflows.Workflow) => JSON.stringify(option),
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
  onChange: (v: workflows.Workflow | null) => void
  workflows: workflows.Workflow[] | typeof L | Error
  value: workflows.Workflow | null
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
    (__e, newValue: workflows.Workflow | null) => onChange(newValue),
    [onChange],
  )
  const errorMessage = errors.map(({ message }) => message).join('; ')
  if (workflows === L) return <Skeleton />
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
