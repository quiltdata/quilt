import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles({
  checkbox: {
    margin: '-2px',
  },
})

interface CheckboxFilterProps {
  value: boolean | undefined
  onChange: (v: boolean) => void
}

interface CheckboxProps
  extends Omit<M.FormControlLabelProps, keyof CheckboxFilterProps | 'control'>,
    CheckboxFilterProps {}

export default function Checkbox({ value, onChange, ...props }: CheckboxProps) {
  const classes = useStyles()
  return (
    <M.FormControlLabel
      {...props}
      control={
        <M.Checkbox
          className={classes.checkbox}
          checked={value}
          onChange={(event, newValue) => onChange(newValue)}
          size="small"
        />
      }
    />
  )
}
