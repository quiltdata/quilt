import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    paddingLeft: t.spacing(0.5),
  },
  checkbox: {
    margin: t.spacing(-1, 0),
  },
}))

interface CheckboxFilterProps {
  value: boolean | undefined
  onChange: (v: boolean) => void
}

interface CheckboxProps
  extends Omit<M.FormControlLabelProps, keyof CheckboxFilterProps | 'control'>,
    CheckboxFilterProps {}

export default function Checkbox({
  className,
  value,
  onChange,
  ...props
}: CheckboxProps) {
  const classes = useStyles()
  return (
    <M.FormControlLabel
      className={cx(classes.root, className)}
      {...props}
      control={
        <M.Checkbox
          checked={value}
          className={classes.checkbox}
          onChange={(event, newValue) => onChange(newValue)}
          size="small"
        />
      }
    />
  )
}
