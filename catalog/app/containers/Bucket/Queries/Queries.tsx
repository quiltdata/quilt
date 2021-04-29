import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import * as M from '@material-ui/core'

import ElasticSearch from './ElasticSearch'
import Athena from './Athena'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  container: {
    display: 'flex',
    padding: t.spacing(3),
  },
  inner: {
    margin: t.spacing(2, 0, 0),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  panel: {
    flexGrow: 1,
    padding: t.spacing(1, 3),
  },
  select: {
    margin: t.spacing(3, 0),
  },
  tabs: {
    borderRight: `1px solid ${t.palette.divider}`,
  },
  viewer: {
    margin: t.spacing(3, 0),
  },
}))

export default function Queries({
  match: {
    params: { bucket },
  },
}: RouteComponentProps<{ bucket: string }>) {
  const classes = useStyles()

  const [tab, setTab] = React.useState(0)
  const [transitioning, setTransitioning] = React.useState(false)

  const onTab = (event: React.ChangeEvent<{}>, newTab: number) => {
    setTransitioning(true)
    setTab(newTab)
  }

  const onAnimationEnd = () => {
    // Wait till `unmountOnExit` ends
    setTimeout(() => {
      setTransitioning(false)
    }, 300)
  }

  return (
    <M.Container className={classes.container} maxWidth="lg">
      <M.Tabs
        className={classes.tabs}
        orientation="vertical"
        onChange={onTab}
        value={tab}
      >
        <M.Tab label="ElasticSearch" />
        <M.Tab label="Athena SQL" />
      </M.Tabs>
      <M.Fade
        in={tab === 0 && !transitioning}
        mountOnEnter
        unmountOnExit
        onExit={onAnimationEnd}
      >
        <ElasticSearch bucket={bucket} className={classes.panel} />
      </M.Fade>
      <M.Fade
        in={tab === 1 && !transitioning}
        mountOnEnter
        unmountOnExit
        onExit={onAnimationEnd}
      >
        <Athena bucket={bucket} className={classes.panel} />
      </M.Fade>
    </M.Container>
  )
}
