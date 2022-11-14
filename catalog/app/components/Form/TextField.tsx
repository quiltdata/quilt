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
  helperText?: React.ReactNode
  input: RF.FieldInputProps<string>
  validating?: boolean
}

export default function Field({
  InputLabelProps,
  error,
  helperText,
  input,
  validating,
  ...rest
}: FieldProps & M.TextFieldProps) {
  const inputClasses = useFieldInputStyles()
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
