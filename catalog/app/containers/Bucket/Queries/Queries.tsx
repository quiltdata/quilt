import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect, Route, Switch, matchPath } from 'react-router-dom'
import * as M from '@material-ui/core'

import * as NamedRoutes from 'utils/NamedRoutes'

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
    maxWidth: 'calc(100% - 200px)',
    padding: t.spacing(1, 3),
  },
  select: {
    margin: t.spacing(3, 0),
  },
  tabWrapper: {
    alignItems: 'flex-start',
  },
  tabs: {
    borderRight: `1px solid ${t.palette.divider}`,
    width: '200px',
  },
  viewer: {
    margin: t.spacing(3, 0),
  },
}))

type NavTabProps = React.ComponentProps<typeof M.Tab> & React.ComponentProps<typeof Link>

function NavTab(props: NavTabProps) {
  return <M.Tab component={Link} {...props} />
}

enum Section {
  ATHENA,
  ES,
}

export default function Queries({
  location,
  match: {
    params: { bucket },
  },
}: RouteComponentProps<{ bucket: string }>) {
  const classes = useStyles()

  const { paths, urls } = NamedRoutes.use()

  const [tab, setTab] = React.useState(() => {
    if (matchPath(location.pathname, urls.bucketAthenaQueries(bucket)))
      return Section.ATHENA
    return Section.ES
  })

  const onTab = (event: React.ChangeEvent<{}>, newTab: Section) => {
    setTab(newTab)
  }

  const tabClasses = React.useMemo(
    () => ({
      wrapper: classes.tabWrapper,
    }),
    [classes],
  )

  return (
    <M.Container className={classes.container} maxWidth="lg">
      <M.Tabs
        className={classes.tabs}
        orientation="vertical"
        onChange={onTab}
        value={tab}
      >
        <NavTab
          label="ElasticSearch"
          value={Section.ES}
          classes={tabClasses}
          to={urls.bucketESQueries(bucket)}
        />
        <NavTab
          label="Athena SQL"
          value={Section.ATHENA}
          classes={tabClasses}
          to={urls.bucketAthenaQueries(bucket)}
        />
      </M.Tabs>
      <div className={classes.panel}>
        <Switch>
          <Route path={paths.bucketESQueries} component={ElasticSearch} exact />
          <Route path={paths.bucketAthenaQueries} component={Athena} exact />
          <Route path={paths.bucketAthenaQueryExecution} component={Athena} exact />
          <Route>
            <Redirect to={urls.bucketESQueries(bucket)} />
          </Route>
        </Switch>
      </div>
    </M.Container>
  )
}
