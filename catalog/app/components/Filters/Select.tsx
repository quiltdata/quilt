import * as React from 'react'
import * as M from '@material-ui/core'

interface SelectFilterProps<T> {
  extents: T[]
  onChange: (v: T) => void
  value: T | null
  getOptionLabel?: (o: T) => string
}

interface SelectProps<T>
  extends Omit<M.SelectProps, keyof SelectFilterProps<T>>,
    SelectFilterProps<T> {}

export default function Select<T = string>({
  extents,
  value,
  onChange,
  getOptionLabel,
  ...props
}: SelectProps<T>) {
  return (
    <M.Select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      {...props}
    >
      {extents.map((extent) => (
        // @ts-expect-error
        <M.MenuItem value={extent} key={JSON.stringify(extent)}>
          {getOptionLabel ? getOptionLabel(extent) : extent}
        </M.MenuItem>
      ))}
    </M.Select>
  )
}
