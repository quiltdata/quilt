import * as React from 'react'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'

interface FieldProps {
  errors: Record<string, React.ReactNode>
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
}

export function Field({
  input,
  meta,
  errors,
  helperText,
  InputLabelProps,
  ...rest
}: FieldProps & M.TextFieldProps) {
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

interface CheckboxProps {
  errors?: Record<string, React.ReactNode>
  input?: RF.FieldInputProps<boolean>
  meta: RF.FieldMetaState<string | Symbol>
  label?: string
  FormControlLabelProps?: M.FormControlLabelProps
}

export function Checkbox({
  input = {} as RF.FieldInputProps<boolean>,
  meta,
  errors = undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  label = undefined,
  FormControlLabelProps = {} as M.FormControlLabelProps,
  ...rest
}: CheckboxProps & M.CheckboxProps) {
  const classes = useCheckboxStyles()
  return (
    <M.FormControlLabel
      {...FormControlLabelProps}
      control={
        <M.Checkbox
          classes={classes}
          disabled={meta.submitting || meta.submitSucceeded}
          {...input}
          {...rest}
        />
      }
      label={label}
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

interface FormErrorProps {
  errors: Record<string, React.ReactNode>
  error?: string
}

export function FormError({
  error,
  errors,
  ...rest
}: FormErrorProps & M.TypographyProps) {
  const classes = useFormErrorStyles()
  if (!error) return null
  return (
    <M.Typography color="error" classes={classes} {...rest}>
      {errors[error] || error}
    </M.Typography>
  )
}
