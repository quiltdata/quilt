import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Link, Redirect, Route, Switch, matchPath } from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import Athena from './Athena'
import ElasticSearch from './ElasticSearch'

const useStyles = M.makeStyles((t) => ({
  actions: {
    margin: t.spacing(2, 0),
  },
  container: {
    [t.breakpoints.up('sm')]: {
      display: 'flex',
      padding: t.spacing(3),
    },
  },
  inner: {
    margin: t.spacing(2, 0, 0),
  },
  form: {
    margin: t.spacing(0, 0, 4),
  },
  panel: {
    flexGrow: 1,
    padding: t.spacing(2, 0),
    [t.breakpoints.up('sm')]: {
      padding: t.spacing(1, 3),
      maxWidth: 'calc(100% - 200px)',
    },
  },
  select: {
    margin: t.spacing(3, 0),
  },
  tabWrapper: {
    alignItems: 'flex-start',
  },
  tabs: {
    [t.breakpoints.down('sm')]: {
      borderBottom: `1px solid ${t.palette.divider}`,
    },
    [t.breakpoints.up('sm')]: {
      borderRight: `1px solid ${t.palette.divider}`,
      width: t.spacing(20),
    },
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

  const t = M.useTheme()
  const sm = M.useMediaQuery(t.breakpoints.down('sm'))

  return (
    <div className={classes.container}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <M.Tabs
        className={classes.tabs}
        orientation={sm ? 'horizontal' : 'vertical'}
        onChange={onTab}
        value={tab}
        centered={sm}
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
    </div>
  )
}
