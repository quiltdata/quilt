import * as React from 'react'
import * as M from '@material-ui/core'

import type { FormStatus } from '../State/form'
import type { MessageState } from '../State/message'

interface InputMessageProps {
  formStatus: FormStatus
  state: MessageState
}

export default function InputMessage({
  formStatus,
  state: { status, value, onChange },
}: InputMessageProps) {
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
