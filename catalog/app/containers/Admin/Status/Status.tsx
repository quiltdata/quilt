import * as React from 'react'
import * as M from '@material-ui/core'

import * as Model from 'model'
import MetaTitle from 'utils/MetaTitle'
import useQuery from 'utils/useQuery'

import Canaries from './Canaries'
import Reports from './Reports'
import Stats from './Stats'
import STATUS_QUERY from './gql/Status.generated'

const STATS_WINDOW = 30
const DEFAULT_REPORTS_PER_PAGE = 25
const DEFAULT_REPORTS_ORDER = Model.GQLTypes.StatusReportListOrder.NEW_FIRST

export default function Status() {
  const { status } = useQuery({
    query: STATUS_QUERY,
    variables: {
      statsWindow: STATS_WINDOW,
      reportsPerPage: DEFAULT_REPORTS_PER_PAGE,
      reportsOrder: DEFAULT_REPORTS_ORDER,
    },
    suspend: true,
  }).data!

  return (
    <M.Box my={2}>
      <MetaTitle>{['Status', 'Admin']}</MetaTitle>
      {status ? (
        <>
          <Stats
            latest={status.latestStats}
            stats={status.stats}
            statsWindow={STATS_WINDOW}
          />
          <M.Box pt={2} />
          <Canaries canaries={status.canaries} />
          <M.Box pt={2} />
          <Reports
            total={status.reports.total}
            firstPage={status.reports.page}
            defaultPerPage={DEFAULT_REPORTS_PER_PAGE}
            defaultOrder={DEFAULT_REPORTS_ORDER}
          />
        </>
      ) : (
        <M.Box py={2}>
          <M.Typography variant="h4" align="center" gutterBottom>
            No Data
          </M.Typography>
          <M.Typography align="center">
            Status monitoring is not enabled for this stack
          </M.Typography>
        </M.Box>
      )}
    </M.Box>
  )
}
