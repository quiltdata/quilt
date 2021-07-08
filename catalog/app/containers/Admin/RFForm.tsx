import * as React from 'react'
import * as M from '@material-ui/core'

type FieldProps = M.TextFieldProps & {
  meta: $TSFixMe
  input: {
    value: $TSFixMe
    onChange: (value: $TSFixMe) => void
  }
  error?: string
  errors: Record<string, string>
  helperText?: React.ReactNode
  validating?: boolean
}

export function Field({ input, meta, errors, helperText, ...rest }: FieldProps) {
  const error = meta.submitFailed && (meta.error || meta.submitError)
  const props = {
    error: !!error,
    helperText: error ? errors[error] || error : helperText,
    disabled: meta.submitting || meta.submitSucceeded,
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}

const useFormErrorStyles = M.makeStyles((t) => ({
  root: {
    marginTop: t.spacing(3),

    '& a': {
      textDecoration: 'underline',
    },
  },
}))

type FormErrorProps = M.TypographyProps & {
  error?: string
  errors: Record<string, string>
}

export function FormError({ error, errors, ...rest }: FormErrorProps) {
  const classes = useFormErrorStyles()
  return !error ? null : (
    <M.Typography color="error" classes={classes} {...rest}>
      {errors[error] || error}
    </M.Typography>
  )
}
