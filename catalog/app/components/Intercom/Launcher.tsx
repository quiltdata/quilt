import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

import logo from './logo.svg'

const DOM_ID = 'intercom-mount-point'

export const SELECTOR = `#${DOM_ID}`

const useStyles = M.makeStyles((t) => ({
  root: {
    backgroundColor: t.palette.secondary.main,
    cursor: 'pointer',
    height: '30px',
    width: '30px',
  },
  img: {
    width: '16px',
  },
}))

interface LauncherProps {
  className: string
}

export function Launcher({ className }: LauncherProps) {
  const classes = useStyles()
  return (
    <M.Avatar
      id={DOM_ID}
      className={cx(classes.root, className)}
      title="Get live support"
    >
      <img className={classes.img} src={logo} />
    </M.Avatar>
  )
}
