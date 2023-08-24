import invariant from 'invariant'
import * as React from 'react'
import { Navigate, Route, Routes, useParams } from 'react-router-dom'
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

      <Routes>
        <Route path={paths.bucketESQueries} element={<ElasticSearch />} />
        <Route path={paths.bucketAthena} element={<Athena />}>
          <Route path={paths.bucketAthenaWorkgroup} element={<Athena />}>
            <Route path={paths.bucketAthenaExecution} element={<Athena />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to={urls.bucketAthena(bucket)} />} />
      </Routes>
    </div>
  )
}
