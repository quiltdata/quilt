import * as React from 'react'
import * as M from '@material-ui/core'

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
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
  tab: {
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
  '@keyframes activate': {
    '0%': {
      transform: 'scaleX(0.5)',
    },
    '100%': {
      opacity: 'scaleX(1)',
    },
  },
}))

interface OptionsTabsProps {
  labels: [string, string]
  children: (activeTab: number) => React.ReactNode
}

export default function OptionsTabs({ labels, children }: OptionsTabsProps) {
  const classes = useStyles()
  const [activeTab, setActiveTab] = React.useState(0)

  return (
    <div className={classes.root}>
      <M.Paper className={classes.tabsContainer} elevation={1}>
        <M.Button
          className={`${classes.tabButton} ${activeTab === 0 ? classes.activeTab : ''}`}
          onClick={() => setActiveTab(0)}
        >
          {labels[0]}
        </M.Button>
        <M.Button
          className={`${classes.tabButton} ${activeTab === 1 ? classes.activeTab : ''}`}
          onClick={() => setActiveTab(1)}
        >
          {labels[1]}
        </M.Button>
      </M.Paper>
      <div className={classes.tab}>{children(activeTab)}</div>
    </div>
  )
}
