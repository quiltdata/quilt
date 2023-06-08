import * as M from '@material-ui/core'
import * as React from 'react'
import cx from 'classnames'

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
  root: ({ fullWidth, hide }: { fullWidth?: boolean; hide?: boolean }) => ({
    display: hide ? 'none' : 'flex',
    flexBasis: '100%',
    flexDirection: 'column',
    flexGrow: 0,
    overflowY: 'auto',
    [t.breakpoints.down('xs')]: {
      paddingBottom: t.spacing(3),
    },
    ...(fullWidth
      ? null
      : {
          [t.breakpoints.up('sm')]: {
            height: '100%',
            flexBasis: '50%',
            maxWidth: `calc(50% - ${t.spacing(GAP / 2)}px)`,
          },
        }),
  }),
}))

interface ColumnProps {
  children: React.ReactNode
  className?: string
  fullWidth?: boolean
  hide?: boolean
}

export function Column({
  children,
  className,
  fullWidth = false,
  hide = false,
}: ColumnProps) {
  const classes = useColumnStyles({
    hide,
    fullWidth,
  })
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

export function LeftColumn(props: ColumnProps) {
  const classes = useLeftColumnStyles()
  return <Column className={classes.root} {...props} />
}
