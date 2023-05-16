import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import { L } from './types'

const useStyles = M.makeStyles((t) => ({
  alert: {
    height: '70px',
  },
  noHelperText: {
    paddingBottom: t.spacing(3),
  },
}))

interface PackageNameProps {
  className?: string
  errors?: Error[] | typeof L
  onChange: (v: string) => void
  value: string
}

export default function PackageName({
  className,
  errors,
  onChange,
  value,
}: PackageNameProps) {
  const classes = useStyles()
  const handleChange = React.useCallback((event) => onChange(event.target.value), [])
  const errorMessage = Array.isArray(errors)
    ? errors.map(({ message }) => message).join('; ')
    : ''
  return (
    <M.TextField
      InputLabelProps={{
        shrink: true,
      }}
      InputProps={{
        endAdornment: errors === L && (
          <M.InputAdornment position="end">
            <M.CircularProgress size={18} />
          </M.InputAdornment>
        ),
      }}
      className={cx({ [classes.noHelperText]: !errorMessage }, className)}
      error={!!errorMessage}
      fullWidth
      helperText={errorMessage}
      label="Package name"
      onChange={handleChange}
      placeholder="Try `foo/bar` and `foo/foo`"
      value={value}
    />
  )
}
