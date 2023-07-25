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

const getOptionLabel = (option: BucketConfig) => option.title

const renderOption = (option: BucketConfig) => (
  <M.ListItemText
    primary={`${option.title ? option.title : option.name} (s3://${option.name})`}
    secondary={option.description}
  />
)

const groupBy = (
  option: BucketConfig,
  buckets: BucketConfig[] | typeof L | Error,
  successors: BucketConfig[],
) => {
  if (Array.isArray(buckets) && buckets.includes(option)) return 'All buckets'
  if (successors.includes(option)) return 'Successors'
  return 'Other'
}

const renderInput = (
  { InputProps, ...params }: M.TextFieldProps,
  errorMessage: string,
  buckets: BucketConfig[] | typeof L | Error,
) => (
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
      ...InputProps,
      endAdornment: (
        <>
          {buckets === L ? <M.CircularProgress color="inherit" size={18} /> : null}
          {InputProps?.endAdornment}
        </>
      ),
    }}
  />
)

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
  successors: BucketConfig[]
  buckets: BucketConfig[] | typeof L | Error
  value: BucketConfig | null
  disabled?: boolean
}

function DestinationBucket({
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
  const items = React.useMemo(
    () => (Array.isArray(buckets) ? [...successors, ...buckets] : successors),
    [successors, buckets],
  )

  const groupByMemo = React.useCallback(
    (option) => groupBy(option, buckets, successors),
    [buckets, successors],
  )

  const renderInputMemo = React.useCallback(
    (params) => renderInput(params, errorMessage, buckets),
    [errorMessage, buckets],
  )

  return (
    <Lab.Autocomplete
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      disabled={disabled}
      filterOptions={filterOptions}
      getOptionLabel={getOptionLabel}
      groupBy={groupByMemo}
      onChange={handleChange}
      options={items}
      renderInput={renderInputMemo}
      renderOption={renderOption}
      value={value}
    />
  )
}

interface DestinationBucketContainerProps
  extends Omit<DestinationBucketProps, 'successors'> {
  successors: BucketConfig[] | typeof L | Error
}

export default function DestinationBucketContainer({
  successors,
  ...props
}: DestinationBucketContainerProps) {
  const classes = useStyles()

  if (successors === L) return <InputSkeleton />
  if (successors instanceof Error) {
    return (
      <Lab.Alert className={classes.alert} severity="error">
        {successors.message}
      </Lab.Alert>
    )
  }

  return <DestinationBucket successors={successors} {...props} />
}
