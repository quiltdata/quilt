import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    cursor: 'pointer',
    margin: t.spacing(0, 1, 0, 0),
  },
}))

interface ButtonExpandProps {
  className?: string
  onClick: () => void
}

export default function ButtonExpand({ className, onClick }: ButtonExpandProps) {
  const classes = useStyles()

  return (
    <M.InputAdornment
      className={cx(classes.root, className)}
      onClick={onClick}
      position="start"
    >
      <M.Icon fontSize="small">arrow_right</M.Icon>
    </M.InputAdornment>
  )
}
