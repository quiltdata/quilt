import * as React from 'react'
import * as M from '@material-ui/core'

interface TextFieldProps {
  extents: { value: string; title: string }[]
  onChange: (v: string) => void
  value: string
}

export default function RadioGroup({ extents, onChange, value }: TextFieldProps) {
  return (
    <M.FormControl component="fieldset" size="small">
      <M.RadioGroup value={value} onChange={(event) => onChange(event.target.value)}>
        {extents.map((extent) => (
          <M.FormControlLabel
            control={<M.Radio size="small" />}
            key={extent.value}
            label={<M.Typography variant="body2">{extent.title}</M.Typography>}
            value={extent.value}
          />
        ))}
      </M.RadioGroup>
    </M.FormControl>
  )
}
