import * as React from 'react'
import * as RF from 'redux-form/es/immutable'
import * as M from '@material-ui/core'

export function Field({ input, meta, errors, label, ...rest }) {
  const error = meta.submitFailed && meta.error
  const props = {
    error: !!error,
    // TODO: put error into help text or smth
    label: error ? errors[error] || error : label,
    disabled: meta.submitting || meta.submitSucceeded,
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useCheckboxStyles = M.makeStyles(() => ({
  root: {
    paddingBottom: 0,
    paddingTop: 0,
  },
}))

export function Checkbox({ input, meta, errors, label, FormControlLabelProps, ...rest }) {
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
  return (
    !!error && (
      <M.Typography color="error" classes={classes} {...rest}>
        {errors[error] || error}
      </M.Typography>
    )
  )
}

export const ReduxForm = RF.reduxForm()(({ children, ...props }) => children(props))
