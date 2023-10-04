import invariant from 'invariant'
import * as React from 'react'
import { Redirect, Route, Switch, useParams } from 'react-router-dom'
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

export default function Queries() {
  const { bucket } = useParams<{ bucket: string }>()
  invariant(!!bucket, '`bucket` must be defined')

  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <Switch>
        <Route path={paths.bucketESQueries} exact>
          <ElasticSearch />
        </Route>
        <Route path={paths.bucketAthena} exact>
          <Athena />
        </Route>
        <Route path={paths.bucketAthenaWorkgroup} exact>
          <Athena />
        </Route>
        <Route path={paths.bucketAthenaExecution} exact>
          <Athena />
        </Route>
        <Route>
          <Redirect to={urls.bucketAthena(bucket)} />
        </Route>
      </Switch>
    </div>
  )
}
