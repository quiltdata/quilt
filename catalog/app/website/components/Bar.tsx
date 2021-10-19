import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useBarStyles = M.makeStyles((t) => ({
  root: {
    width: 40,
    height: 2,
  },
  primary: {
    background: t.palette.primary.light,
  },
  secondary: {
    background: t.palette.secondary.main,
  },
  tertiary: {
    background: (t.palette as $TSFixMe).tertiary.main,
  },
}))

interface BarProps extends M.BoxProps {
  color?: 'primary' | 'secondary' | 'tertiary'
}

export default function Bar({ color = 'primary', className, ...props }: BarProps) {
  const classes = useBarStyles()
  return <M.Box className={cx(className, classes.root, classes[color])} {...props} />
}
