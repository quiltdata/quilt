import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const DOM_ID = 'intercom-mount-point'

export const SELECTOR = `#${DOM_ID}`

const useStyles = M.makeStyles((t) => ({
  root: {
    fontWeight: t.typography.fontWeightRegular,
    minWidth: t.spacing(4),
  },
  img: {
    marginRight: t.spacing(-1),
  },
}))

interface LauncherProps {
  className: string
}

export function Launcher({ className }: LauncherProps) {
  const classes = useStyles()
  return (
    <M.Tooltip title="Chat with Quilt support">
      <M.Button
        className={cx(classes.root, className)}
        color="primary"
        id={DOM_ID}
        startIcon={
          <M.Icon fontSize="small" className={classes.img}>
            chat_bubble_outline
          </M.Icon>
        }
        variant="contained"
        size="small"
      />
    </M.Tooltip>
  )
}
