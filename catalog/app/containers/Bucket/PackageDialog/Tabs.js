import * as React from 'react'
import cx from 'classnames'
import * as M from '@material-ui/core'

export const TABS = {
  FILES: 0,
  METADATA: 1,
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

export default function Tabs({ className, errors, tab, onTabChange }) {
  const classes = useStyles()

  return (
    <M.Tabs
      className={cx(classes.root, className)}
      value={tab}
      onChange={(e, t) => onTabChange(t)}
    >
      <M.Tab
        label={<TabContent title="Files" error={errors.files && tab !== TABS.FILES} />}
      />
      <M.Tab
        label={
          <TabContent title="Metadata" error={errors.meta && tab !== TABS.METADATA} />
        }
      />
    </M.Tabs>
  )
}
