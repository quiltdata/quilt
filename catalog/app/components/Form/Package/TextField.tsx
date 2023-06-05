import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import L from 'constants/loading'

const useStyles = M.makeStyles((t) => ({
  alert: {
    height: '70px',
  },
  noHelperText: {
    paddingBottom: t.spacing(3),
  },
}))

interface TextFieldEssential {
  className?: string
  errors?: Error[] | typeof L
  onChange: (v: string) => void
  value: string
  warnings?: string[] | typeof L
}

export type TextFieldProps = TextFieldEssential &
  Omit<M.TextFieldProps, 'onChange' | 'value'>

export default function TextField({
  className,
  errors,
  onChange,
  value,
  warnings,
  ...props
}: TextFieldProps) {
  const classes = useStyles()
  const handleChange = React.useCallback(
    (event) => onChange(event.target.value),
    [onChange],
  )
  const { invalid, helperText } = React.useMemo(() => {
    const errorMessage = Array.isArray(errors)
      ? errors.map(({ message }) => message).join('; ')
      : ''
    const warningMessage = Array.isArray(warnings) ? warnings.join('; ') : ''
    return {
      invalid: !!errorMessage,
      helperText: [errorMessage, warningMessage].filter(Boolean).join('; '),
    }
  }, [errors, warnings])
  return (
    <M.TextField
      InputLabelProps={{
        shrink: true,
      }}
      InputProps={{
        endAdornment: (errors === L || warnings === L) && (
          <M.InputAdornment position="end">
            <M.CircularProgress size={18} />
          </M.InputAdornment>
        ),
      }}
      className={cx({ [classes.noHelperText]: !helperText }, className)}
      error={invalid}
      fullWidth
      helperText={helperText}
      onChange={handleChange}
      value={value}
      {...props}
    />
  )
}
