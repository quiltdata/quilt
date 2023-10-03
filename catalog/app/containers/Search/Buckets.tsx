import * as React from 'react'

import * as Filters from 'components/Filters'
import * as BucketConfig from 'utils/BucketConfig'

import * as SearchUIModel from './model'

export default function Buckets() {
  const model = SearchUIModel.use()
  const bucketConfigs = BucketConfig.useRelevantBucketConfigs()
  const extents = React.useMemo(() => bucketConfigs.map((b) => b.name), [bucketConfigs])
  return (
    <Filters.Enum
      extents={extents}
      label="In buckets"
      onChange={model.actions.setBuckets}
      placeholder="Select buckets"
      size="small"
      value={model.state.buckets}
      variant="outlined"
    />
  )
}
