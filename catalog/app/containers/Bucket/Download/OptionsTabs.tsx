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
      duration: t.transitions.duration.short,
      easing: t.transitions.easing.easeOut,
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
  download: {
    width: t.spacing(40),
  },
  code: {
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

type TabType = 'download' | 'code'

const TABS_LABELS: Record<TabType, string> = {
  download: 'Download',
  code: 'Code',
}

type TabsProps = Record<TabType, React.ReactNode>

export function Tabs({ download, code }: TabsProps) {
  const classes = useStyles()
  const [activeTab, setActiveTab] = React.useState<TabType>('download')

  const renderTab = (tab: TabType) => (
    <M.Button
      className={cx(classes.tabButton, { [classes.activeTab]: activeTab === tab })}
      onClick={() => setActiveTab(tab)}
    >
      {TABS_LABELS[tab]}
    </M.Button>
  )

  return (
    <div className={cx(classes.root, classes[activeTab])}>
      <M.Paper className={classes.tabsContainer} elevation={1}>
        {renderTab('download')}
        {renderTab('code')}
      </M.Paper>
      {activeTab === 'download' ? download : code}
    </div>
  )
}
