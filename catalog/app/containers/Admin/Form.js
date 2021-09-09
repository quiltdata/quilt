import * as React from 'react'
import * as M from '@material-ui/core'

export function Field({ input, meta, errors, helperText, InputLabelProps, ...rest }) {
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    InputLabelProps: { shrink: true, ...InputLabelProps },
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useCheckboxStyles = M.makeStyles({
  root: {
    marginBottom: -9,
    marginTop: -9,
  },
})

export function Checkbox({
  input = {},
  meta,
  errors = undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  label = undefined,
  FormControlLabelProps = {},
  ...rest
}) {
  const classes = useCheckboxStyles()
  return (
    <M.FormControlLabel
      control={
        <M.Checkbox
          classes={classes}
          disabled={meta.submitting || meta.submitScceeded}
          {...input}
          {...rest}
        />
      }
      label={label}
      {...FormControlLabelProps}
    />
  )
}

const useFormErrorStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(3),

    '& a': {
      textDecoration: 'underline',
    },
  },
}))

export function FormError({ error, errors, ...rest }) {
  const classes = useFormErrorStyles()
  if (!error) return null
  return (
    <M.Typography color="error" classes={classes} {...rest}>
      {errors[error] || error}
    </M.Typography>
  )
}
