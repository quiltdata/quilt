import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface SelectFilterProps<T> {
  className?: string
  extents: T[]
  getOptionLabel?: (o: T) => string
  onChange: (v: T) => void
  value: T | null
}

interface SelectProps<T>
  extends Omit<M.SelectProps, keyof SelectFilterProps<T>>,
    SelectFilterProps<T> {}

export default function Select<T extends string>({
  className,
  extents,
  getOptionLabel,
  onChange,
  value,
  ...props
}: SelectProps<T>) {
  const classes = useStyles()
  return (
    <M.Select
      className={cx(classes.root, className)}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      {...props}
    >
      {extents.map((extent) => (
        <M.MenuItem value={extent} key={JSON.stringify(extent)}>
          {getOptionLabel ? getOptionLabel(extent) : extent}
        </M.MenuItem>
      ))}
    </M.Select>
  )
}
