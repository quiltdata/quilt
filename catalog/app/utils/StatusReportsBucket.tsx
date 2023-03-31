import { useQueryS } from 'utils/GraphQL'

import STATUS_REPORTS_BUCKET_QUERY from './StatusReportsBucket.generated'

export function useStatusReportsBucket() {
  const { status } = useQueryS(STATUS_REPORTS_BUCKET_QUERY)
  return status.__typename === 'Status' ? status.reportsBucket : null
}
