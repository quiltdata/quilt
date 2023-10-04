import * as React from 'react'
import * as M from '@material-ui/core'

import Skel from 'components/Skeleton'

const useSkeletonStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    height: t.spacing(30),
    width: '100%',
  },
  lineNumbers: {
    height: '100%',
    width: t.spacing(5),
  },
  content: {
    flexGrow: 1,
    marginLeft: t.spacing(2),
  },
  line: {
    height: t.spacing(2),
    marginBottom: t.spacing(0.5),
  },
}))

const fakeLines = [80, 50, 100, 60, 30, 80, 50, 100, 60, 30, 20, 70]

export default function Skeleton() {
  const classes = useSkeletonStyles()
  return (
    <div className={classes.root}>
      <Skel className={classes.lineNumbers} height="100%" />
      <div className={classes.content}>
        {fakeLines.map((width, index) => (
          <Skel className={classes.line} width={`${width}%`} key={width + index} />
        ))}
      </div>
    </div>
  )
}
