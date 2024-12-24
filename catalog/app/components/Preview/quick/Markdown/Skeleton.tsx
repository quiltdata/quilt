import * as React from 'react'
import * as M from '@material-ui/core'

import Skel from 'components/Skeleton'

const useSkeletonStyles = M.makeStyles((t) => ({
  line: {
    height: t.spacing(3),
    marginBottom: t.spacing(1),
  },
}))

const LINES = [80, 50, 100, 60, 30, 80, 50, 100, 60, 30, 20, 70]

export default function Skeleton() {
  const classes = useSkeletonStyles()
  return (
    <div>
      {LINES.map((width, index) => (
        <Skel className={classes.line} width={`${width}%`} key={width + index} />
      ))}
    </div>
  )
}
