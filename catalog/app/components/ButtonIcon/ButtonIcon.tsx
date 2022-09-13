import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  left: {
    marginRight: t.spacing(1),
  },
  right: {
    marginLeft: t.spacing(1),
  },
}))

interface ButtonIconProps extends M.IconProps {
  position?: 'left' | 'right'
}

export default function ButtonIcon({
  className,
  position = 'left',
  ...props
}: ButtonIconProps) {
  const classes = useStyles()
  return <M.Icon {...props} className={cx(className, classes[position])} />
}
