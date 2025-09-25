import * as React from 'react'
import * as M from '@material-ui/core'

import type { FormStatus } from '../State/form'
import type { NameState } from '../State/name'
import { PackageNameWarning } from '../PackageDialog'

interface InputNameProps {
  formStatus: FormStatus
  state: NameState
}

export default function InputName({
  formStatus,
  state: { value, onChange, status },
}: InputNameProps) {
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
