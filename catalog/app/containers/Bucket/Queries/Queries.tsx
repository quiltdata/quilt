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
  invariant(!!bucket, '`bucket` must be defined')

  const classes = useStyles()
  const { paths, urls } = NamedRoutes.use()
  return (
    <div className={classes.root}>
      <MetaTitle>{['Queries', bucket]}</MetaTitle>

      <RRDom.Switch>
        <RRDom.Route path={paths.bucketESQueries} exact>
          <ElasticSearch />
        </RRDom.Route>
        <RRDom.Route path={paths.bucketAthena} exact>
          <Athena />
        </RRDom.Route>
        <RRDom.Route path={paths.bucketAthenaWorkgroup} exact>
          <Athena />
        </RRDom.Route>
        <RRDom.Route path={paths.bucketAthenaExecution} exact>
          <Athena />
        </RRDom.Route>
        <RRDom.Route>
          <RRDom.Redirect to={urls.bucketAthena(bucket)} />
        </RRDom.Route>
      </RRDom.Switch>
    </div>
  )
}
