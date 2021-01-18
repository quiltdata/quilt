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
    flexBasis: '100%',
    flexGrow: 0,
    margin: t.spacing(0, 0, 3),
    [t.breakpoints.up('sm')]: {
      flexBasis: '50%',
      margin: t.spacing(0, 3, 0, 0),
      maxWidth: 'calc(50% - 16px)',
    },
  },
}))

export function Column({ children, className }) {
  const classes = useColumnStyles()

  return <div className={cx(classes.root, className)}>{children}</div>
}

export const LeftColumn = Column

const useRightColumnStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('sm')]: {
      margin: t.spacing(0, 0, 3),
    },
  },
}))

export function RightColumn({ children }) {
  const classes = useRightColumnStyles()

  return <Column className={classes.root}>{children}</Column>
}
