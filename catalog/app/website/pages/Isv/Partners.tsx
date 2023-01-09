import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {},
}))

interface PartnersProps {
  className?: string
}

export default function Partners({ className }: PartnersProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, className)}></div>
}
