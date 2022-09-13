import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

interface FieldOwnProps {
  error?: string
  errors: Record<string, React.ReactNode>
  helperText?: React.ReactNode
  validating?: boolean
}

type FieldProps = FieldOwnProps & RF.FieldRenderProps<string> & M.TextFieldProps

export function Field({ input, meta, errors, helperText, ...rest }: FieldProps) {
  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))
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
