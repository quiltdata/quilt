import * as M from '@material-ui/core'
import * as React from 'react'
import cx from 'classnames'

const useContainerStyles = M.makeStyles(() => ({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
  },
}))

export function Container({ children }) {
  const classes = useContainerStyles()

  return <div className={classes.root}>{children}</div>
}

const useColumnStyles = M.makeStyles((t) => ({
  root: {
    flexGrow: 0,
    marginBottom: '32px',
    flexBasis: '100%',
    [t.breakpoints.up('lg')]: {
      flexBasis: '50%',
      margin: '0 32px 0 0',
      maxWidth: 'calc(50% - 16px)',
    },
  },
  rightColumn: {
    margin: t.spacing(0, 0, 4),
    [t.breakpoints.up('lg')]: {
      margin: t.spacing(0, 0, 3),
    },
  },
}))

export function Column({ children, className }) {
  const classes = useColumnStyles()

  return <div className={cx(classes.root, className)}>{children}</div>
}

export const LeftColumn = Column

export function RightColumn({ children }) {
  const classes = useColumnStyles()

  return <Column className={classes.rightColumn}>{children}</Column>
}
