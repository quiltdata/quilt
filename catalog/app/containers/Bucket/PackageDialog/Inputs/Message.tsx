import * as React from 'react'
import * as M from '@material-ui/core'

import * as State from '../state'

export default function InputMessage() {
  const {
    formStatus,
    values: {
      message: { status, value, onChange },
    },
  } = State.use()
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChange(event.target.value),
    [onChange],
  )
  return (
    <M.TextField
      /*style*/
      InputLabelProps={{ shrink: true }}
      fullWidth
      margin="normal"
      /*constants*/
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      helperText={status._tag === 'error' && status.error.message}
      label="Message"
      placeholder="Enter a commit message"
      /*data*/
      onChange={handleChange}
      value={value || ''}
    />
  )
}
