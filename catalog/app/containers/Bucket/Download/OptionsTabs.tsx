import * as React from 'react'
import * as M from '@material-ui/core'
import cx from 'classnames'

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
      backgroundColor: t.palette.secondary.main,
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
      transform: 'scaleX(1)',
    },
  },
}))

interface TabsProps {
  children: (activeTab: number) => React.ReactNode
}

export function Tabs({ children }: TabsProps) {
  const classes = useStyles()
  const [activeTab, setActiveTab] = React.useState(0)

  const renderTab = React.useCallback(
    (tab: number) => (
      <M.Button
        className={cx(classes.tabButton, { [classes.activeTab]: activeTab === tab })}
        onClick={() => setActiveTab(tab)}
      >
        {tab === 0 ? 'Download' : 'Code'}
      </M.Button>
    ),
    [activeTab, classes],
  )

  return (
    <div
      className={cx(classes.root, {
        [classes.downloadWidth]: activeTab === 0,
        [classes.codeWidth]: activeTab === 1,
      })}
    >
      <M.Paper className={classes.tabsContainer} elevation={1}>
        {renderTab(0)}
        {renderTab(1)}
      </M.Paper>
      {children(activeTab)}
    </div>
  )
}
