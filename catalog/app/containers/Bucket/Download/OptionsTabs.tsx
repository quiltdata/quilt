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
  quiltSync: {
    padding: t.spacing(0, 0, 2),
    borderBottom: `1px solid ${t.palette.divider}`,
    marginBottom: t.spacing(1),
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

export interface Tab {
  label: string
  content: React.ReactNode
}

interface OptionsTabsProps {
  tabs: Tab[]
  initialTab?: number
}

export default function OptionsTabs({ tabs, initialTab = 0 }: OptionsTabsProps) {
  const classes = useStyles()
  const [activeTab, setActiveTab] = React.useState(initialTab)
  
  return (
    <div className={classes.root}>
      <M.Paper className={classes.tabsContainer} elevation={1}>
        {tabs.map((tab, index) => (
          <React.Fragment key={index}>
            {index > 0 && <M.Divider orientation="vertical" />}
            <M.Button
              className={`${classes.tabButton} ${activeTab === index ? classes.activeTab : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {tab.label}
            </M.Button>
          </React.Fragment>
        ))}
      </M.Paper>
      <div className={classes.tab}>
        {tabs[activeTab].content}
      </div>
    </div>
  )
}

export { useStyles }
