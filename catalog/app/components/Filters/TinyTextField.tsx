import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    border: `1px solid ${t.palette.divider}`,
    borderRadius: t.shape.borderRadius,
    fontSize: t.typography.body2.fontSize,
    padding: t.spacing(0, 1),
  },
}))

type TinyTextFieldProps = Omit<M.InputBaseProps, 'onChange'> & {
  onChange: (value: string) => void
}

export default function TinyTextField({
  className,
  onChange,
  value,
  ...props
}: TinyTextFieldProps) {
  const classes = useStyles()
  return (
    <M.InputBase
      className={cx(classes.root, className)}
      endAdornment={
        value && (
          <M.InputAdornment position="end">
            <M.IconButton size="small" onClick={() => onChange('')}>
              <M.Icon fontSize="inherit">clear</M.Icon>
            </M.IconButton>
          </M.InputAdornment>
        )
      }
      onChange={(event) => onChange(event.target.value)}
      value={value}
      {...props}
    />
  )
}
