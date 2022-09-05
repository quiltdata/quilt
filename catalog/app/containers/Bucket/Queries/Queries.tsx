import * as React from 'react'
import { RouteComponentProps } from 'react-router'
import { Redirect, Route, Switch } from 'react-router-dom'
import * as M from '@material-ui/core'

import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

import Athena from './Athena'
import ElasticSearch from './ElasticSearch'

const useStyles = M.makeStyles((t) => ({
  root: {
    padding: t.spacing(2, 0),
  },
}))

export default function Queries({
  match: {
    params: { bucket },
  },
}: RouteComponentProps<{ bucket: string }>) {
  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <Switch>
        <Route path={paths.bucketESQueries} component={ElasticSearch} exact />
        <Route path={paths.bucketAthena} component={Athena} exact />
        <Route path={paths.bucketAthenaWorkgroup} component={Athena} exact />
        <Route path={paths.bucketAthenaExecution} component={Athena} exact />
        <Route>
          <Redirect to={urls.bucketAthena(bucket)} />
        </Route>
      </Switch>
    </div>
  )
}
