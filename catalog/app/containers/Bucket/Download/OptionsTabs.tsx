import * as React from 'react'
import * as M from '@material-ui/core'
import cx from 'classnames'

const useTabPanelStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 2, 1),
    animation: `$show 150ms ease-out`,
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

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    transition: t.transitions.create('width', {
      duration: t.transitions.duration.standard,
      easing: t.transitions.easing.easeInOut,
    }),
  },
  tabsContainer: {
    borderRadius: `${t.shape.borderRadius}px ${t.shape.borderRadius}px 0 0`,
    display: 'flex',
    height: t.spacing(5),
  },
  tabButton: {
    flex: 1,
    color: t.palette.text.secondary,
    borderRadius: 0,
    textTransform: 'none',
    position: 'relative',
    '&:hover': {
      backgroundColor: t.palette.action.hover,
    },
  },
  activeTab: {
    color: t.palette.text.primary,
    '&:after': {
      animation: `$activate 150ms ease-out`,
      content: '""',
      position: 'absolute',
      bottom: '-2px',
      left: 0,
      right: 0,
      height: '2px',
      backgroundColor: t.palette.primary.main,
    },
  },
  downloadWidth: {
    width: t.spacing(40),
  },
  codeWidth: {
    width: t.spacing(80),
  },
  '@keyframes activate': {
    '0%': {
      transform: 'scaleX(0.5)',
    },
    '100%': {
      opacity: 'scaleX(1)',
    },
  },
}))

interface TabsProps {
  labels: [string, string]
  children: (activeTab: number) => React.ReactNode
}

export function Tabs({ labels, children }: TabsProps) {
  const classes = useStyles()
  const [activeTab, setActiveTab] = React.useState(0)

  return (
    <div className={cx(classes.root, activeTab === 0 ? classes.downloadWidth : classes.codeWidth)}>
      <M.Paper className={classes.tabsContainer} elevation={1}>
        <M.Button
          className={cx(classes.tabButton, { [classes.activeTab]: activeTab === 0 })}
          onClick={() => setActiveTab(0)}
        >
          {labels[0]}
        </M.Button>
        <M.Button
          className={cx(classes.tabButton, { [classes.activeTab]: activeTab === 1 })}
          onClick={() => setActiveTab(1)}
        >
          {labels[1]}
        </M.Button>
      </M.Paper>
      {children(activeTab)}
    </div>
  )
}
