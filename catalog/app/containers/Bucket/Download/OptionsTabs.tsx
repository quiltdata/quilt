import * as React from 'react'
import * as M from '@material-ui/core'

import { Tab, Tabs as TabsInternal } from 'components/Dialog'

const useStyles = M.makeStyles((t) => ({
  root: {
    overflow: 'hidden',
    transition: t.transitions.create('width', {
      duration: t.transitions.duration.short,
      easing: t.transitions.easing.easeOut,
    }),
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

interface TabsProps {
  children: {
    label: NonNullable<React.ReactNode>
    panel: NonNullable<React.ReactNode>
    width?: number | string // className?
  }[]
}

export function Tabs({ children }: TabsProps) {
  const classes = useStyles()
  const [activeIndex, setActiveIndex] = React.useState<number>(0)
  const activeTab = children[activeIndex]
  return (
    <div className={classes.root} style={{ width: activeTab.width }}>
      <TabsInternal>
        {children.map(({ label }, index) => (
          <Tab
            active={activeIndex === index}
            key={index}
            onClick={() => setActiveIndex(index)}
          >
            {label}
          </Tab>
        ))}
      </TabsInternal>
      {activeTab.panel}
    </div>
  )
}
