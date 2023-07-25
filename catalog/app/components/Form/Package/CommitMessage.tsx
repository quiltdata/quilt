import * as React from 'react'

import TextField, { TextFieldProps } from './TextField'

export default function PackageName(props: TextFieldProps) {
  return <TextField placeholder="Enter a commit message" label="Message" {...props} />
}
