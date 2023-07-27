import invariant from 'invariant'
import * as React from 'react'
import { Redirect, Switch } from 'react-router-dom'
import * as RRDomCompat from 'react-router-dom-v5-compat'
import { CompatRoute } from 'react-router-dom-v5-compat'
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
  const { bucket } = RRDomCompat.useParams<{ bucket: string }>()
  invariant(!!bucket, `bucket must be defined`)

  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <Switch>
        <CompatRoute path={paths.bucketESQueries} component={ElasticSearch} exact />
        <CompatRoute path={paths.bucketAthena} component={Athena} exact />
        <CompatRoute path={paths.bucketAthenaWorkgroup} component={Athena} exact />
        <CompatRoute path={paths.bucketAthenaExecution} component={Athena} exact />
        <CompatRoute>
          <Redirect to={urls.bucketAthena(bucket)} />
        </CompatRoute>
      </Switch>
    </div>
  )
}
