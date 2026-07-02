import * as React from 'react'
import { Redirect } from 'react-router-dom'
import * as M from '@material-ui/core'

import Layout from 'components/Layout'
import Placeholder from 'components/Placeholder'
import * as Buckets from 'utils/Buckets'
import MetaTitle from 'utils/MetaTitle'
import * as NamedRoutes from 'utils/NamedRoutes'

// "Tables" is the per-bucket Athena Queries workbench promoted into the rail
// as a global surface. Athena workgroups and the query editor are not
// bucket-scoped in the backend; the historical route nesting was. This page
// keeps the proven workbench code and lifts the entry point: it lands on the
// workbench of the volume you're in (or the most relevant volume), where the
// rail's volume selector re-scopes it.
function TablesRedirect() {
  const { urls } = NamedRoutes.use()
  const currentBucket = Buckets.useCurrentBucket()
  const buckets = Buckets.useRelevantBuckets()
  const target = currentBucket || buckets[0]?.name
  if (target) return <Redirect to={urls.bucketAthena(target)} />
  return (
    <>
      <M.Typography variant="h5">Tables</M.Typography>
      <M.Typography color="textSecondary">
        No volumes are available to query. Add a bucket to run Athena SQL over its tables.
      </M.Typography>
    </>
  )
}

export default function Tables() {
  return (
    <Layout>
      <MetaTitle>Tables</MetaTitle>
      <React.Suspense fallback={<Placeholder color="text.secondary" />}>
        <TablesRedirect />
      </React.Suspense>
    </Layout>
  )
}
