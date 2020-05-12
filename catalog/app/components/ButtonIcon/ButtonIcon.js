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

// position: left | right
export default function ButtonIcon({ className, position = 'left', ...props }) {
  const classes = useStyles()
  return <M.Icon {...props} className={cx(className, classes[position])} />
}
