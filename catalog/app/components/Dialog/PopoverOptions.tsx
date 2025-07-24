import cx from 'classnames'
import * as React from 'react'
import * as M from '@material-ui/core'

const useTabStyles = M.makeStyles((t) => ({
  root: {
    flex: 1,
    color: t.palette.text.secondary,
    borderRadius: 0,
    textTransform: 'none',
    position: 'relative',
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  active: {
    color: t.palette.text.primary,
    '&:after': {
      animation: `$activate 150ms ease-out`,
      content: '""',
      position: 'absolute',
      bottom: '-2px',
      left: 0,
      right: 0,
      height: '2px',
      backgroundColor: t.palette.secondary.main,
    },
  },
}))

interface TabProps {
  active?: boolean
  children: NonNullable<React.ReactNode>
  className?: string
  onClick: () => void
}

export function Tab({ active, onClick, className, children }: TabProps) {
  const classes = useTabStyles()
  return (
    <M.Button
      className={cx(classes.root, active && classes.active, className)}
      onClick={onClick}
    >
      {children}
    </M.Button>
  )
}

const useTabsStyles = M.makeStyles((t) => ({
  root: {
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
    display: 'flex',
    height: t.spacing(5),
  },
}))

interface TabsProps {
  children: NonNullable<React.ReactNode>
}

export function Tabs({ children }: TabsProps) {
  const classes = useTabsStyles()
  return (
    <M.Paper className={classes.root} elevation={1}>
      {children}
    </M.Paper>
  )
}

const useTabPanelStyles = M.makeStyles((t) => ({
  root: {
    animation: `$show 150ms ease-out`,
    minWidth: t.spacing(40),
    padding: t.spacing(2, 2, 1),
  },
  '@keyframes show': {
    '0%': {
      opacity: 0.3,
    },
    '100%': {
      opacity: '1',
    },
  },
}))

interface TabPanelProps {
  children: React.ReactNode
  className?: string
}

export function TabPanel({ children, className }: TabPanelProps) {
  const classes = useTabPanelStyles()
  return <div className={cx(classes.root, className)}>{children}</div>
}
