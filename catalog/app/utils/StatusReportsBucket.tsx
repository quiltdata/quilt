import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as GQL from 'utils/GraphQL'

import STATUS_REPORTS_BUCKET_QUERY from './StatusReportsBucket.generated'

export function useStatusReportsBucket() {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  const isAdmin = redux.useSelector(AuthSelectors.isAdmin)
  const pause = !authenticated || !isAdmin
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { status } = GQL.useQueryS(STATUS_REPORTS_BUCKET_QUERY, {}, { pause })
    return status.__typename === 'Status' ? status.reportsBucket : null
  } catch (e) {
    // still waiting for a response
    if (e instanceof Promise) throw e
    // we don't want to crash the app, and the error is automatically logged anyway
    return null
  }
}
