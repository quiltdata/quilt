import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const DOM_ID = 'intercom-mount-point'

export const SELECTOR = `#${DOM_ID}`

const useStyles = M.makeStyles((t) => ({
  root: {
    fontWeight: t.typography.fontWeightRegular,
  },
}))

interface LauncherProps {
  className: string
}

export function Launcher({ className }: LauncherProps) {
  const classes = useStyles()
  return (
    <M.Button
      className={cx(classes.root, className)}
      color="inherit"
      id={DOM_ID}
      size="small"
      startIcon={<M.Icon fontSize="small">chat_bubble_outline</M.Icon>}
    >
      Support
    </M.Button>
  )
}
