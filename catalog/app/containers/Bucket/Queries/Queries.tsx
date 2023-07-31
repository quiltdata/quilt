import invariant from 'invariant'
import * as React from 'react'
import * as RRDom from 'react-router-dom'
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
  const { bucket } = RRDom.useParams<{ bucket: string }>()
  invariant(!!bucket, `bucket must be defined`)

  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <RRDom.Switch>
        <Route path={paths.bucketESQueries} component={ElasticSearch} exact />
        <Route path={paths.bucketAthena} component={Athena} exact />
        <Route path={paths.bucketAthenaWorkgroup} component={Athena} exact />
        <Route path={paths.bucketAthenaExecution} component={Athena} exact />
        <Route>
          <RRDom.Redirect to={urls.bucketAthena(bucket)} />
        </Route>
      </RRDom.Switch>
    </div>
  )
}
