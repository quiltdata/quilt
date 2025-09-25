import cx from 'classnames'
import * as R from 'ramda'
import * as React from 'react'
import * as M from '@material-ui/core'

export function calcDialogHeight(windowHeight: number, metaHeight: number): number {
  const neededSpace = 345 /* space to fit other inputs */ + metaHeight
  const availableSpace = windowHeight - 200 /* free space for headers */
  const minimalSpace = 420 /* minimal height */
  if (availableSpace < minimalSpace) return minimalSpace
  return R.clamp(minimalSpace, availableSpace, neededSpace)
}

export const useContentStyles = M.makeStyles({
  root: {
    height: ({ metaHeight }: { metaHeight: number }) =>
      calcDialogHeight(window.innerHeight, metaHeight),
    paddingTop: 0,
  },
})

// TODO: use grid
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

const GAP = 3

const useColumnStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
    flexBasis: '100%',
    flexDirection: 'column',
    flexGrow: 0,
    overflowY: 'auto',
    [t.breakpoints.down('xs')]: {
      paddingBottom: t.spacing(3),
    },
    [t.breakpoints.up('sm')]: {
      height: '100%',
      flexBasis: '50%',
      maxWidth: `calc(50% - ${t.spacing(GAP / 2)}px)`,
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

export const RightColumn = Column

const useLeftColumnStyles = M.makeStyles((t) => ({
  root: {
    [t.breakpoints.up('sm')]: {
      marginRight: t.spacing(GAP),
    },
  },
}))

export function LeftColumn(props: React.PropsWithChildren<{}>) {
  const classes = useLeftColumnStyles()
  return <Column className={classes.root} {...props} />
}
