import * as React from 'react'
import * as M from '@material-ui/core'

import useId from 'utils/useId'

// MUI only links a TextField's label to its input when it has an id.
export default function Field(props: M.TextFieldProps) {
  const id = useId()
  return <M.TextField id={id} {...props} />
}
