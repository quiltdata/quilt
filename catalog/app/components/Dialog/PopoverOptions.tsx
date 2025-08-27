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

function Tab({ active, onClick, className, children }: TabProps) {
  const classes = useTabStyles()
  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation()
      onClick()
    },
    [onClick],
  )
  return (
    <M.Button
      className={cx(classes.root, active && classes.active, className)}
      onClick={handleClick}
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

interface TabsContainerProps {
  children: NonNullable<React.ReactNode>
}

function TabsContainer({ children }: TabsContainerProps) {
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

function TabPanel({ children, className }: TabPanelProps) {
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
  children: {
    label: NonNullable<React.ReactNode>
    panel: NonNullable<React.ReactNode>
    className?: string
  }[]
}

export function Tabs({ children }: TabsProps) {
  const classes = useStyles()
  const [activeIndex, setActiveIndex] = React.useState<number>(0)
  const activeTab = children[activeIndex]
  return (
    <div className={cx(classes.root, activeTab.className)}>
      {children.length > 1 && (
        <TabsContainer>
          {children.map(({ label }, index) => (
            <Tab
              key={index}
              active={activeIndex === index}
              onClick={() => setActiveIndex(index)}
            >
              {label}
            </Tab>
          ))}
        </TabsContainer>
      )}
      <TabPanel>{activeTab.panel}</TabPanel>
    </div>
  )
}
