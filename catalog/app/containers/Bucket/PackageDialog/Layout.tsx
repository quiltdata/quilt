import * as M from '@material-ui/core'
import * as React from 'react'
import cx from 'classnames'

const useContainerStyles = M.makeStyles({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    height: '100%',
  },
})

export function Container({ children }: React.PropsWithChildren<{}>) {
  const classes = useContainerStyles()

  return <div className={classes.root}>{children}</div>
}

const useColumnStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexBasis: '100%',
    flexDirection: 'column',
    flexGrow: 0,
    padding: t.spacing(0, 0, 3),
    overflowY: 'auto',
    [t.breakpoints.up('sm')]: {
      height: '100%',
      flexBasis: '50%',
      padding: t.spacing(0, 3, 0, 0),
      maxWidth: 'calc(50% - 16px)',
    },
  },
}))

export function Column({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  const classes = useColumnStyles()

  return <div className={cx(classes.root, className)}>{children}</div>
}

export const LeftColumn = Column

const useRightColumnStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(0, 0, 3),
    },
  },
}))

export function RightColumn({ children }: React.PropsWithChildren<{}>) {
  const classes = useRightColumnStyles()

  return <Column className={classes.root}>{children}</Column>
}
