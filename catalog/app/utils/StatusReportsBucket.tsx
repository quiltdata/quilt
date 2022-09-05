import invariant from 'invariant'

import useQuery from 'utils/useQuery'

import STATUS_REPORTS_BUCKET_QUERY from './StatusReportsBucket.generated'

export function useStatusReportsBucket() {
  const result = useQuery({
    query: STATUS_REPORTS_BUCKET_QUERY,
    suspend: true,
  })
  invariant(result.data, 'No data')
  const { status } = result.data
  return status.__typename === 'Status' ? status.reportsBucket : null
}
