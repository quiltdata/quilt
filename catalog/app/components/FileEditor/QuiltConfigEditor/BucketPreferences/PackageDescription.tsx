import cx from 'classnames'
import jsonpath from 'jsonpath'
import React from 'react'
import * as M from '@material-ui/core'
import * as Lab from '@material-ui/lab'

import type { PackagePreferencesInput } from 'utils/BucketPreferences/BucketPreferences'

import type { KeyedValue } from './State'

// TODO:
//   - Option to reset values to defaults (delete them from the config)
//     * easy for athena and default source bucket
//     * don't know how for checkboxes
//   - Update utils/BucketPreferences on write
//   - Validate package description, don't allow empty string because we have '.*'
//   - Add new package description explicitly with button
//   - invalidate defaultSourceBucket on sourceBuckets update

interface JsonPathsProps {
  disabled?: boolean
  onChange: (value: string[]) => void
  size: 'small' | 'medium'
  value?: readonly string[]
}

const options: string[] = []

const emptyArray: string[] = []

function JsonPaths({ disabled, onChange, size, value = [] }: JsonPathsProps) {
  const [error, setError] = React.useState<Error | null>(null)
  const handleChange = React.useCallback(
    (_e, labels: string[]) => {
      onChange(labels)
      try {
        labels.forEach((label: string) => jsonpath.parse(label))
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Invalid JSON path'))
      }
    },
    [onChange],
  )
  const handleBlur = React.useCallback(
    (e) => {
      const labels = e.target.value.split(',').map((x: string) => x.trim())
      if (labels.join(',') === value.join(',')) return
      handleChange(e, labels)
    },
    [handleChange, value],
  )
  return (
    <Lab.Autocomplete
      disabled={disabled}
      freeSolo
      multiple
      options={options}
      onChange={handleChange}
      renderInput={(params) => (
        <M.TextField
          {...params}
          InputLabelProps={{
            shrink: true,
          }}
          error={!!error}
          helperText={error?.message}
          label="Metadata fields (JSON paths from `user_meta`)"
          placeholder="e.g. $.Some.Key, $.Another.Key"
          onBlur={handleBlur}
        />
      )}
      size={size}
      value={(value as string[]) || emptyArray}
    />
  )
}

interface MessageProps {
  disabled?: boolean
  onChange: (value: boolean) => void
  size: 'small' | 'medium'
  value?: boolean
}

function Message({ disabled, onChange, size, value = false }: MessageProps) {
  const handleChange = React.useCallback(
    (_e, checked: boolean) => onChange(checked),
    [onChange],
  )
  return (
    <M.FormControl>
      <M.FormControlLabel
        control={<M.Checkbox checked={value} size={size} onChange={handleChange} />}
        disabled={disabled}
        label="Display commit message"
      />
    </M.FormControl>
  )
}

interface PackageHandleProps {
  disabled?: boolean
  onChange: (value: string) => void
  size: 'small' | 'medium'
  value: string
}

function PackageHandle({
  disabled,
  onChange,
  size,
  value: initialValue,
}: PackageHandleProps) {
  const [value, setValue] = React.useState(initialValue)
  const handleEnter = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === 'Enter') {
        onChange(value)
      }
    },
    [onChange, value],
  )
  const handleChange = React.useCallback((event) => setValue(event.target.value), [])
  return (
    <M.TextField
      InputLabelProps={{
        shrink: true,
      }}
      disabled={disabled}
      label="Package name pattern (RegExp or substring)"
      onBlur={() => onChange(value)}
      onChange={handleChange}
      onKeyDown={handleEnter}
      placeholder="e.g. ^prefix/.*"
      size={size}
      value={value}
    />
  )
}

const useStyles = M.makeStyles((t) => ({
  root: {
    animation: '$appear 0.3s ease-out',
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    display: 'grid',
    gridTemplateRows: '1fr 1fr 1fr',
    padding: t.spacing(2, 2, 0),
    position: 'relative',
    rowGap: t.spacing(1),
  },
  close: {
    position: 'absolute',
    right: t.spacing(1),
    top: t.spacing(1),
  },
  '@keyframes appear': {
    '0%': { opacity: 0 },
    '100%': { opacity: 1 },
  },
}))

interface PackageDescriptionProps {
  className?: string
  disabled?: boolean
  handlePattern: string
  onChange: (handlePattern: string, value: PackagePreferencesInput) => void
  onRename: (oldHandlePattern: string, newHandlePattern: string) => void
  onDelete?: (handlePattern: string) => void
  size: 'small' | 'medium'
  value: PackagePreferencesInput
}

function PackageDescription({
  className,
  disabled,
  handlePattern,
  onChange,
  onDelete,
  onRename,
  size,
  value,
}: PackageDescriptionProps) {
  const classes = useStyles()
  const handleRename = React.useCallback(
    (newHandlePattern: string) => onRename(handlePattern, newHandlePattern),
    [onRename, handlePattern],
  )
  const handleMessage = React.useCallback(
    (message) => onChange(handlePattern, { ...value, message }),
    [handlePattern, onChange, value],
  )
  const handleLabels = React.useCallback(
    (user_meta: string[]) => onChange(handlePattern, { ...value, user_meta }),
    [handlePattern, onChange, value],
  )
  const handleDelete = React.useCallback(
    () => onDelete && onDelete(handlePattern),
    [handlePattern, onDelete],
  )
  return (
    <div className={cx(classes.root, className)}>
      <PackageHandle
        disabled={disabled}
        size={size}
        value={handlePattern}
        onChange={handleRename}
      />
      <JsonPaths
        disabled={disabled || !handlePattern}
        onChange={handleLabels}
        size={size}
        value={value.user_meta}
      />
      <Message
        disabled={disabled || !handlePattern}
        onChange={handleMessage}
        size={size}
        value={value.message}
      />
      {onDelete && (
        <M.IconButton className={classes.close} onClick={handleDelete} size="small">
          <M.Icon>close</M.Icon>
        </M.IconButton>
      )}
    </div>
  )
}

const usePackageDescriptionsListStyles = M.makeStyles((t) => ({
  root: {
    columnGap: t.spacing(2),
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    marginTop: t.spacing(1),
    rowGap: t.spacing(2),
  },
}))

interface PackageDescriptionsListProps {
  className?: string
  disabled?: boolean
  onChange: (v: KeyedValue<'ui.package_description'>['value']) => void
  size: 'small' | 'medium'
  value: KeyedValue<'ui.package_description'>['value']
}

const empty = {}

export default function PackageDescriptionsList({
  className,
  disabled,
  size,
  value,
  onChange,
}: PackageDescriptionsListProps) {
  const classes = usePackageDescriptionsListStyles()

  const handleKeyChange = React.useCallback(
    (oldKey: string, newKey: string) => {
      const { [oldKey]: val, ...rest } = value
      onChange({
        ...rest,
        [newKey]: val,
      })
    },
    [onChange, value],
  )
  const handleValueChange = React.useCallback(
    (key: string, val: PackagePreferencesInput) => {
      onChange({
        ...value,
        [key]: val,
      })
    },
    [onChange, value],
  )

  const handleNewKey = React.useCallback(
    (_, key: string) => {
      onChange({
        ...value,
        [key]: {},
      })
    },
    [onChange, value],
  )

  const handleDelete = React.useCallback(
    (key: string) => {
      const { [key]: deleted, ...rest } = value
      onChange({
        ...rest,
      })
    },
    [onChange, value],
  )

  const packageHandles = React.useMemo(() => Object.entries(value), [value])

  return (
    <div className={cx(classes.root, className)}>
      {packageHandles.map(([k, v]) => (
        <PackageDescription
          disabled={disabled}
          key={k}
          handlePattern={k}
          value={v}
          size={size}
          onRename={handleKeyChange}
          onChange={handleValueChange}
          onDelete={handleDelete}
        />
      ))}
      <PackageDescription
        key={`${packageHandles.length}`}
        disabled={disabled}
        handlePattern=""
        value={empty}
        size={size}
        onRename={handleNewKey}
        onChange={handleValueChange}
      />
    </div>
  )
}
