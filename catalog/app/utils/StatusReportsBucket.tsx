import * as redux from 'react-redux'

import * as AuthSelectors from 'containers/Auth/selectors'
import * as GQL from 'utils/GraphQL'

import STATUS_REPORTS_BUCKET_QUERY from './StatusReportsBucket.generated'

export function useStatusReportsBucket() {
  const authenticated = redux.useSelector(AuthSelectors.authenticated)
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { status } = GQL.useQueryS(
      STATUS_REPORTS_BUCKET_QUERY,
      {},
      { pause: !authenticated },
    )
    return status.__typename === 'Status' ? status.reportsBucket : null
  } catch (e) {
    // this happens when the user is not authenticated
    if (e instanceof GQL.Paused) return null
    // FIXME: don't swallow errors
    return null
  }
}
