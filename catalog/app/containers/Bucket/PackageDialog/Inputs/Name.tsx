import * as React from 'react'
import * as M from '@material-ui/core'

import * as State from '../State'
import { PackageNameWarning } from '../PackageDialog'

export default function InputName() {
  const {
    formStatus,
    name: { value, onChange, status },
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
      helperText={<PackageNameWarning />}
      disabled={formStatus._tag === 'submitting'}
      error={status._tag === 'error'}
      label="Name"
      placeholder="e.g. user/package"
      /*data*/
      onChange={handleChange}
      value={value || ''}
    />
  )
}
