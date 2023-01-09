import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {},
}))

interface FeaturesProps {
  className?: string
}

export default function Features({ className }: FeaturesProps) {
  const classes = useStyles()
  return <div className={cx(classes.root, className)}></div>
}
