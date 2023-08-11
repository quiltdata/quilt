import * as React from 'react'
import * as M from '@material-ui/core'

interface FilterProps {
  value: string
  onChange: (v: string) => void
}

export default function Filter({ value, onChange }: FilterProps) {
  return (
    <M.InputBase
      endAdornment={
        value && (
          <M.IconButton onClick={() => onChange('')}>
            <M.Icon fontSize="small">clear</M.Icon>
          </M.IconButton>
        )
      }
      fullWidth
      onChange={(event) => onChange(event.target.value)}
      placeholder="Filter"
      startAdornment={<M.Icon fontSize="small">search</M.Icon>}
      value={value}
    />
  )
}
