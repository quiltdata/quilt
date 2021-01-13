import * as React from 'react'
import cx from 'classnames'
import * as M from '@material-ui/core'

export const TABS = {
  FILES: {
    key: 'files',
    title: 'Files',
  },
  METADATA: {
    key: 'metadata',
    title: 'Metadata',
  },
}

const useTabContentStyles = M.makeStyles((t) => ({
  root: {
    display: 'flex',
  },
  icon: {
    marginLeft: t.spacing(1),
  },
}))

function TabContent({ title, error }) {
  const classes = useTabContentStyles()

  return (
    <span className={classes.root}>
      {title}
      {error ? (
        <M.Icon className={classes.icon} color="error">
          error
        </M.Icon>
      ) : null}
    </span>
  )
}

const useStyles = M.makeStyles(() => ({
  root: {
    borderBottom: '1px solid rgba(0,0,0,0.2)',
  },
}))

export default function Tabs({ className, errors, tab, tabsList, onTabChange }) {
  const classes = useStyles()

  return (
    <M.Tabs
      className={cx(classes.root, className)}
      value={tab}
      onChange={(e, t) => onTabChange(t)}
    >
      {tabsList.map((tabData) => (
        <M.Tab
          label={
            <TabContent
              title={tabData.title}
              error={errors[tabData.key] && tab !== tabData}
            />
          }
          value={tabData}
          key={tabData.key}
        />
      ))}
    </M.Tabs>
  )
}
