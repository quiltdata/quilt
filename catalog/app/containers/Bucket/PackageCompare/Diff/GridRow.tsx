import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
  },
  dense: {
    '& $side': {
      padding: t.spacing(1),
    },
  },
  divided: {
    '& $side + $side': {
      borderLeft: `1px solid ${t.palette.divider}`,
    },
  },
  side: {
    overflow: 'hidden',
    padding: t.spacing(1.5, 1),
  },
}))

interface GridRowProps {
  className: string
  children: React.ReactNode[]
  dense?: boolean
  divided?: boolean
}

export default function GridRow({ className, children, dense, divided }: GridRowProps) {
  const classes = useStyles()
  return (
    <div
      className={cx(className, classes.root, {
        [classes.dense]: dense,
        [classes.divided]: divided,
      })}
    >
      {children.map((side, i) => (
        <div key={i} className={cx(classes.side)}>
          {side}
        </div>
      ))}
    </div>
  )
}
