import * as React from 'react'
import type * as RF from 'react-final-form'
import * as M from '@material-ui/core'

const useCheckboxStyles = M.makeStyles({
  root: {
    marginBottom: -9,
    marginTop: -9,
  },
})

interface CheckboxProps {
  FormControlLabelProps?: M.FormControlLabelProps
  FormControlProps?: M.FormControlProps
  errors?: Record<string, React.ReactNode>
  input?: RF.FieldInputProps<boolean>
  label?: string
  meta: RF.FieldMetaState<string | Symbol>
}

export default function Checkbox({
  FormControlLabelProps = {} as M.FormControlLabelProps,
  FormControlProps = {} as M.FormControlProps,
  errors = undefined, // eslint-disable-line @typescript-eslint/no-unused-vars
  input = {} as RF.FieldInputProps<boolean>,
  label = undefined,
  meta,
  ...rest
}: CheckboxProps & M.CheckboxProps) {
  const classes = useCheckboxStyles()
  return (
    <M.FormControl {...FormControlProps}>
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
    </M.FormControl>
  )
}
