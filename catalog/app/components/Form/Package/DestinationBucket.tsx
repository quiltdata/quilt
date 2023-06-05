import cx from 'classnames'
import * as React from 'react'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

import L from 'constants/loading'
import * as Model from 'model'

import InputSkeleton from './InputSkeleton'

export type BucketConfig = Pick<
  Model.GQLTypes.BucketConfig,
  'name' | 'title' | 'description'
>

const filterOptions = Lab.createFilterOptions({
  stringify: (option: BucketConfig) => JSON.stringify(option),
})

const useStyles = M.makeStyles((t) => ({
  alert: {
    height: '70px',
  },
  noHelperText: {
    paddingBottom: t.spacing(3),
  },
}))

interface DestinationBucketProps {
  className?: string
  errors?: Error[]
  onChange: (v: BucketConfig | null) => void
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
  value: BucketConfig | null
  disabled?: boolean
}

export default function DestinationBucket({
  className,
  errors,
  onChange,
  buckets,
  successors,
  value,
  disabled = false,
}: DestinationBucketProps) {
  const classes = useStyles()
  const handleChange = React.useCallback(
    (__e, newValue: BucketConfig | null) => onChange(newValue),
    [onChange],
  )
  const errorMessage = Array.isArray(errors)
    ? errors.map(({ message }) => message).join('; ')
    : ''
  const items = React.useMemo(() => {
    if (!Array.isArray(successors)) return []
    return Array.isArray(buckets) ? [...successors, ...buckets] : successors
  }, [successors, buckets])
  if (successors === L) return <InputSkeleton />
  if (successors instanceof Error) {
    return (
      <Lab.Alert className={classes.alert} severity="error">
        {successors.message}
      </Lab.Alert>
    )
  }
  return (
    <Lab.Autocomplete
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      filterOptions={filterOptions}
      groupBy={(option) => {
        if (Array.isArray(buckets) && buckets.includes(option)) return 'All buckets'
        if (successors.includes(option)) return 'Successors'
        return 'Other'
      }}
      getOptionLabel={(option) => option.title}
      onChange={handleChange}
      options={items}
      disabled={disabled}
      renderOption={(option) => (
        <M.ListItemText
          primary={`${option.title ? option.title : option.name} (s3://${option.name})`}
          secondary={option.description}
        />
      )}
      renderInput={(params) => (
        <M.TextField
          {...params}
          fullWidth
          label="Destination bucket"
          placeholder="Destination bucket"
          InputLabelProps={{
            shrink: true,
          }}
          helperText={errorMessage}
          error={!!errorMessage}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {buckets === L ? <M.CircularProgress color="inherit" size={18} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      value={value}
    />
  )
}
