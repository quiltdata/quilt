import * as React from 'react'
import * as M from '@material-ui/core'

import * as APIConnector from 'utils/APIConnector'
import * as Cache from 'utils/ResourceCache'

import * as data from './data'

export default function Buckets() {
  const req = APIConnector.use()
  const buckets = Cache.useData(data.BucketsResource, { req })
  console.log('buckets', buckets)
  return (
    <M.Box mt={2} mb={2}>
      <h1>buckets</h1>
    </M.Box>
  )
}
