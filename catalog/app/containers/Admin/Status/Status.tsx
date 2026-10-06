import * as React from 'react'
import * as M from '@material-ui/core'

import { docs } from 'constants/urls'
import { useQueryS } from 'utils/GraphQL'
import MetaTitle from 'utils/MetaTitle'
import StyledLink from 'utils/StyledLink'

import Canaries from './Canaries'
import Indexing from './Indexing'
import Reports from './Reports'
import Stats from './Stats'
import STATUS_QUERY from './gql/Status.generated'
import {
  DEFAULT_REPORTS_ORDER,
  DEFAULT_REPORTS_PER_PAGE,
  STATS_WINDOW,
} from './constants'

export default function Status() {
  const { status } = useQueryS(STATUS_QUERY, {
    statsWindow: STATS_WINDOW,
    reportsPerPage: DEFAULT_REPORTS_PER_PAGE,
    reportsOrder: DEFAULT_REPORTS_ORDER,
  })

  React.useEffect(() => {
    if (window.location.hash !== '#indexing') return
    const el = document.getElementById('indexing')
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // Mount only: a re-run would yank a scrolled-down admin back to the panel
    // on every later render.
  }, [])

  return (
    <M.Box my={2}>
      <MetaTitle>{['Status', 'Admin']}</MetaTitle>
      <Indexing />
      <M.Box pt={2} />
      {status.__typename === 'Status' ? (
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
        <M.Container maxWidth="sm">
          <M.Box py={2}>
            <M.Typography variant="h5" align="center" gutterBottom>
              Status monitoring is not enabled
            </M.Typography>
            <M.Typography align="center" gutterBottom>
              Status monitoring is an add-on feature that automates quality testing for
              GxP and other compliance regimes.
            </M.Typography>
            <M.Typography align="center">
              <StyledLink
                href={`${docs}/quilt-platform-administrator/best-practices/good-practice`}
                target="_blank"
              >
                Learn more
              </StyledLink>{' '}
              or <StyledLink href="mailto:sales@quiltdata.io">contact sales</StyledLink>.
            </M.Typography>
          </M.Box>
        </M.Container>
      )}
    </M.Box>
  )
}
