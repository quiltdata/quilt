import * as React from 'react'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'

const useFieldInputStyles = M.makeStyles({
  root: {
    // It hides M.CircularProgress (spinning square) overflow
    overflow: 'hidden',
  },
})

interface FieldProps {
  error?: string
  errors: Record<string, React.ReactNode>
  helperText?: React.ReactNode
  input: RF.FieldInputProps<string>
  meta: RF.FieldMetaState<string>
  validating?: boolean
}

export type TextFieldProps = FieldProps & M.TextFieldProps

export default function Field({
  InputLabelProps,
  helperText,
  input,
  validating,
  errors,
  meta,
  ...rest
}: TextFieldProps) {
  const inputClasses = useFieldInputStyles()
  const errorCode = meta.submitFailed && meta.error
  const error = errorCode ? errors[errorCode] || errorCode : ''
  const props = {
    InputLabelProps: { shrink: true, ...InputLabelProps },
    InputProps: {
      endAdornment: validating && <M.CircularProgress size={20} />,
      classes: inputClasses,
    },
    error: !!error,
    helperText: error || helperText,
    ...input,
    ...rest,
  }
  return <M.TextField {...props} />
}
