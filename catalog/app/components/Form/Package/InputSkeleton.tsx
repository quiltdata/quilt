import * as React from 'react'
import * as M from '@material-ui/core'

import Skel from 'components/Skeleton'

const useStyles = M.makeStyles({
  label: {
    height: '12px',
    width: '100px',
  },
  input: {
    height: '32px',
    margin: '6px 0',
  },
  helperText: {
    height: '18px',
    width: '50%',
  },
})

interface SkeletonProps {
  className?: string
}

export default function Skeleton({ className }: SkeletonProps) {
  const classes = useStyles()
  return (
    <div className={className}>
      <Skel className={classes.label} animate />
      <Skel className={classes.input} animate />
      <Skel className={classes.helperText} animate />
    </div>
  )
}
