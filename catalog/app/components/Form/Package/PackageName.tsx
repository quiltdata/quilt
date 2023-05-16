import * as React from 'react'

import TextField, { TextFieldProps } from './TextField'

export default function PackageName(props: TextFieldProps) {
  return (
    <TextField
      placeholder="Try `foo/bar` and `foo/foo`"
      label="Package name"
      {...props}
    />
  )
}
