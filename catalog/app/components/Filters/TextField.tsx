import * as React from 'react'
import * as M from '@material-ui/core'

interface TextFieldFilterProps {
  value: string
  onChange: (v: string) => void
}

interface TextFieldProps
  extends Omit<M.TextFieldProps, keyof TextFieldFilterProps>,
    TextFieldFilterProps {}

export default function TextField({ value, onChange, ...props }: TextFieldProps) {
  return (
    <M.TextField
      onChange={(event) => onChange(event.target.value)}
      size="small"
      value={value}
      variant="outlined"
      {...props}
    />
  )
}
