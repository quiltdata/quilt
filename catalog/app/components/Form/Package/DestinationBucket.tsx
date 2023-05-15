import cx from 'classnames'
import * as React from 'react'
import * as Lab from '@material-ui/lab'
import * as M from '@material-ui/core'

import Skel from 'components/Skeleton'
import * as Model from 'model'

import { L } from './types'

export type BucketConfig = Pick<
  Model.GQLTypes.BucketConfig,
  'name' | 'title' | 'description'
>

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

const useStyles = M.makeStyles((t) => ({
  alert: {
    height: '70px',
  },
  noHelperText: {
    paddingBottom: t.spacing(3),
  },
}))

type BucketsGroup = BucketConfig[] | typeof L | Error

interface DestinationBucketProps {
  className?: string
  errors: Error[]
  onChange: (v: BucketConfig | null) => void
  successors: BucketConfig[] | typeof L | Error
  buckets: BucketConfig[] | typeof L | Error
  value: BucketConfig | null
}

export default function DestinationBucket({
  className,
  errors,
  onChange,
  buckets,
  successors,
  value,
}: DestinationBucketProps) {
  const classes = useStyles()
  const handleChange = React.useCallback(
    (__e, newValue: BucketConfig | null) => onChange(newValue),
    [onChange],
  )
  const errorMessage = errors.map(({ message }) => message).join('; ')
  if (successors === L) return <Skeleton />
  if (successors instanceof Error) {
    return (
      <Lab.Alert className={classes.alert} severity="error">
        {successors.message}
      </Lab.Alert>
    )
  }
  const items = React.useMemo(() => {
    if (Array.isArray(buckets)) return [...successors, ...buckets]
    return successors
  }, [successors, buckets])
  return (
    <Lab.Autocomplete
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      options={items}
      groupBy={(option) => {
        if (Array.isArray(buckets) && buckets.includes(option)) return 'All buckets'
        if (successors.includes(option)) return 'Successors'
        return 'Other'
      }}
      getOptionLabel={(option) => option.name}
      onChange={handleChange}
      value={value}
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
    />
  )
}
