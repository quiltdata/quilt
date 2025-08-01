import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import type { Value } from './types'

const useStyles = M.makeStyles((t) => ({
  root: {
    background: t.palette.background.paper,
  },
}))

interface TextFieldFilterProps {
  value: string
  onChange: (v: Value<string>) => void
}

interface TextFieldProps
  extends Omit<M.TextFieldProps, keyof TextFieldFilterProps>,
    TextFieldFilterProps {}

export default function TextField({
  className,
  value,
  onChange,
  ...props
}: TextFieldProps) {
  const classes = useStyles()
  return (
    <M.TextField
      className={cx(classes.root, className)}
      onChange={(event) => onChange(event.target.value)}
      size="small"
      value={value}
      variant="outlined"
      {...props}
    />
  )
}
