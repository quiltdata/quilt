import * as React from 'react'
import * as RF from 'react-final-form'
import * as M from '@material-ui/core'

type ErrorMessageMap = Record<string, React.ReactNode>

interface FieldOwnProps {
  errors: ErrorMessageMap
}

export type FieldProps = FieldOwnProps & RF.FieldRenderProps<string> & M.TextFieldProps

// TODO: re-use components/Form/TextField
// XXX: extract all custom logic into a function and use MUI's TextField (and other components) explicitly
export function Field({
  input,
  meta,
  errors,
  helperText,
  InputLabelProps,
  ...rest
}: FieldProps) {
  const error =
    meta.submitFailed && (meta.error || (!meta.dirtySinceLastSubmit && meta.submitError))
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

export interface CheckboxProps {
  errors?: ErrorMessageMap
  input?: RF.FieldInputProps<boolean>
  meta: RF.FieldMetaState<string | Symbol>
  label?: React.ReactNode
  FormControlLabelProps?: M.FormControlLabelProps
}

// Re-use components/Form/Checkbox
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

interface FormErrorProps extends M.TypographyProps {
  error?: string
  errors: ErrorMessageMap
}

export function FormError({ error, errors, ...rest }: FormErrorProps) {
  const classes = useFormErrorStyles()
  if (!error) return null
  return (
    <M.Typography color="error" classes={classes} {...rest}>
      {errors[error] || error}
    </M.Typography>
  )
}

interface FormErrorAutoProps extends M.TypographyProps {
  children: ErrorMessageMap
}

export function FormErrorAuto({ children: errors, ...props }: FormErrorAutoProps) {
  const state = RF.useFormState({
    subscription: {
      error: true,
      submitError: true,
      submitFailed: true,
    },
  })
  const error = state.submitFailed && (state.submitError || state.error)
  return <FormError error={error} errors={errors} {...props} />
}
